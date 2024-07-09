interface SLRequest {
    connstr: string;
    queries: SLQuery[];
}

interface SLQuery {
    query: string;
    params: any[];
}

interface SLResponse {
    driverName: string;
    queries: CommonQuery[];
}

interface CommonQuery {
    exitnode: string;
    kind: string;
    addr: string;
    driver: string;
    method: string;
    request: string;
    response: string;
    error: string;
    startedAt: Date | undefined;
    finishedAt: Date | undefined;
    isFailed: boolean;
    durationNs: number | undefined;
}
