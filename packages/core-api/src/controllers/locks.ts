import { Boom, notFound } from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/core-kernel";
import { Enums } from "@solar-network/crypto";

import { Identifiers } from "../identifiers";
import { TransactionResource } from "../resources";
import { LockCriteria, lockCriteriaSchemaObject, LockResource } from "../resources-new";
import { LockSearchService } from "../services";
import { Controller } from "./controller";

export interface UnlockedRequest extends Hapi.Request {
    payload: {
        ids: string[];
    };
}

@Container.injectable()
export class LocksController extends Controller {
    @Container.inject(Identifiers.LockSearchService)
    private readonly lockSearchService!: LockSearchService;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public index(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.Search.ResultsPage<LockResource> {
        const pagination = this.getQueryPagination(request.query);
        const sorting = request.query.orderBy as Contracts.Search.Sorting;
        const criteria = this.getQueryCriteria(request.query, lockCriteriaSchemaObject) as LockCriteria;

        return this.lockSearchService.getLocksPage(pagination, sorting, criteria);
    }

    public show(request: Hapi.Request, h: Hapi.ResponseToolkit): { data: LockResource } | Boom {
        const lockId = request.params.id as string;

        const lockResource = this.lockSearchService.getLock(lockId);
        if (!lockResource) {
            return notFound("Lock not found");
        }

        return { data: lockResource };
    }

    public async unlocked(request: UnlockedRequest, h: Hapi.ResponseToolkit) {
        const criteria = [
            {
                typeGroup: Enums.TransactionTypeGroup.Core,
                type: Enums.TransactionType.Core.HtlcClaim,
                asset: request.payload.ids.map((lockId: string) => ({ claim: { lockTransactionId: lockId } })),
            },
            {
                typeGroup: Enums.TransactionTypeGroup.Core,
                type: Enums.TransactionType.Core.HtlcRefund,
                asset: request.payload.ids.map((lockId: string) => ({ refund: { lockTransactionId: lockId } })),
            },
        ];

        const transactionListResult = await this.transactionHistoryService.listByCriteria(
            criteria,
            this.getListingOrder(request),
            this.getListingPage(request),
            this.getListingOptions(),
        );

        return this.toPagination(transactionListResult, TransactionResource);
    }
}
