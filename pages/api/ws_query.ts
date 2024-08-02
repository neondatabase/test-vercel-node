import { Pool } from "@neondatabase/serverless";
import type { NextApiRequest, NextApiResponse } from "next";

// e.g. v22.4.1
import { version } from 'node:process';

// e.g. node-22.4.1
const nodeVersion = `node-${version.substring(1)}`;
const exitnode = `vercel-${nodeVersion}`;

const driverName = "@neondatabase/serverless@0.9.4_leaky";

const awaitTimeout = (delay: number) => new Promise(resolve => setTimeout(resolve, delay));

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse<SLResponse>,
) {
    try {
        const funcBootedAt = new Date();
        const globalTimeout = awaitTimeout(14000).then(() => undefined);

        const slRequest: SLRequest = req.body;

        let queries: CommonQuery[] = [];
        let hasFailedQuery = false;

        let pool;
        const poolConnectStartedAt = new Date();
        try {
            pool = new Pool({
                connectionString: slRequest.connstr,
            });
        } catch (e: any) {
            console.log('new pool caught exception: ' + e.stack);
            const common: CommonQuery = {
                exitnode,
                kind: 'db',
                addr: slRequest.connstr,
                driver: driverName,
                method: 'connect',
                request: "",
                response: "",
                error: e.stack + "\n" + JSON.stringify(e),
                startedAt: poolConnectStartedAt,
                finishedAt: undefined,
                isFailed: true,
                durationNs: undefined,
            };
            queries.push(common);
            hasFailedQuery = true;
        }

        for (const slQuery of slRequest.queries) {
            if (hasFailedQuery) {
                break;
            }

            let params = (slQuery.params == null) ? undefined : slQuery.params;
            const startedAt = new Date();
            let finishedAt = undefined;
            let response = "";
            let error = "";
            let isFailed = false;

            try {
                console.log('running query ' + slQuery.query + ' with connstr ' + slRequest.connstr);
                const rawResult = await Promise.race([pool!.query(slQuery.query, params), globalTimeout]);
                if (!rawResult) {
                    throw new Error("global timeout exceeded, function was invoked at " + funcBootedAt.toISOString());
                }

                finishedAt = new Date();
                const res = {
                    rows: rawResult.rows,
                    rowCount: rawResult.rowCount,
                    command: rawResult.command,
                    fields: rawResult.fields,
                };
                response = JSON.stringify(res);
            } catch (e: any) {
                console.log('query caught exception: ' + e.stack);
                error = e.stack + "\n" + JSON.stringify(e);
                isFailed = true;
            }

            let durationNs;
            if (finishedAt != undefined && startedAt != undefined) {
                durationNs = (finishedAt.getTime() - startedAt.getTime()) * 1000000;
            }

            const common: CommonQuery = {
                exitnode,
                kind: 'db',
                addr: slRequest.connstr,
                driver: driverName,
                method: 'query',
                request: JSON.stringify(slQuery),
                response,
                error,
                startedAt,
                finishedAt,
                isFailed,
                durationNs,
            };
            queries.push(common);

            if (isFailed) {
                break;
            }
        }

        const slResponse: SLResponse = {
            driverName,
            queries,
        };

        res.status(200).json(slResponse);
    } catch (e: any) {
        console.log('global caught exception: ' + e.stack);
        res.status(500).json({
            driverName,
            queries: [{
                exitnode,
                kind: 'unhandled-exception',
                addr: "unknown",
                driver: driverName,
                method: 'catch',
                request: "",
                response: "",
                error: e.stack + "\n" + JSON.stringify(e),
                startedAt: undefined,
                finishedAt: undefined,
                isFailed: true,
                durationNs: undefined,
            }],
        });
    }
}
