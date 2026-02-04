import { Request, Response, NextFunction } from "express";
import dayjs from 'dayjs';
import { LastFmRepository } from "../repositories/last-fm.repository";
import minMax from "dayjs/plugin/minMax"


dayjs.extend(minMax)

export async function resolveDateDefaults(req: Request, res: Response, next: NextFunction) {

    try {
        const userLastFm = req.session.lastFmSession?.user as string


        if (!userLastFm) {
            return next(new Error("Last.FM user not found in session"))
        }

        const userAccountCreationUnixDate = Number(await new LastFmRepository().getCreationUnixtime(userLastFm))

        const comparisonFrom = req.query.comparisonFrom !== undefined
            ? dayjs(req.query.comparisonFrom as string).utc()
            : undefined

        const comparisonTo = req.query.comparisonTo !== undefined
            ? dayjs(req.query.comparisonTo as string).utc()
            : undefined

        const candidateFrom = req.query.candidateFrom !== undefined
            ? dayjs(req.query.candidateFrom as string).utc()
            : undefined

        const candidateTo = req.query.candidateTo !== undefined
            ? dayjs(req.query.candidateTo as string).utc()
            : undefined


        const fetchInDays = Number(req.query.fetchInDays)

        // se candidateFrom for ANTES da data de comparisonFrom, ERRO, por que dados candidatos a serem comparados devem ser procurados depois da data de comparisonFrom.
        if (candidateFrom?.isBefore(comparisonFrom)) {
            return next(new Error("invalid comparison period: Candidate period must start after the comparison period begins"))
        }
        // se comparison cobre alguma parte do período candidate (overlap/interseção entre dois períodos)
        const hasOverlap =
            comparisonFrom?.isBefore(candidateTo) &&
            comparisonTo?.isAfter(candidateFrom)
        if (hasOverlap) {
            return next(
                new Error("Invalid comparison period: Comparison period must not overlap with the candidate period")
            )
        }

        // se comparisonFrom for DEPOIS da data comparisonTo, erro pois comparisonFrom deve ser uma data anterior a comparisonTo
        if (comparisonFrom?.isAfter(comparisonTo)) {
            return next(new Error("'Invalid comparison period: comparisonFrom' must be earlier than 'comparisonTo'"))
        }

        // se candidateFrom for DEPOIS de candidateTo, erro pois candidateFrom deve ser antes de candidateTo
        if (candidateFrom?.isAfter(candidateTo)) {
            return next(new Error("Invalid candidate period: 'candidateFrom' must be earlier than 'candidateTo'"))
        }
        // nenhum parametro de data deve ser ANTES da data de criação da conta
        const dateParametersBeforeCreationAccount = 
            comparisonFrom!.unix() < userAccountCreationUnixDate ||
            comparisonTo!.unix() < userAccountCreationUnixDate ||
            candidateFrom!.unix() < userAccountCreationUnixDate ||
            candidateTo!.unix() < userAccountCreationUnixDate

        if (dateParametersBeforeCreationAccount) {
            return next(new Error("Date parameters must be after account creation date"))
        }
        // nenhum parametro de data deve estar no futuro
        const dateParametersInFuture = 
            comparisonFrom?.isAfter(dayjs().utc()) ||
            comparisonTo?.isAfter(dayjs().utc()) || 
            candidateFrom?.isAfter(dayjs().utc()) ||
            candidateTo?.isAfter(dayjs().utc())

        if (dateParametersInFuture) {
            return next(new Error("Date parameters must not be in the future"))
        }

        // range maximo de busca é de 365 dias
        const rangeStart = dayjs.min(comparisonFrom!, candidateFrom!)
        const rangeEnd = dayjs.max(comparisonTo!, candidateTo!)

        const totalDays = rangeEnd.diff(rangeStart, "day")

        if (totalDays > 365) {
            return next(new Error("The combined comparison and candidate date range must not exceed 365 days"))
        }
        // se fetchindays é 40 dias, a diferença entre datas de candidate e compare não pode ser menor que 40
        if (totalDays < fetchInDays) {
            return next(new Error(`The provided date range is too short. To fetch tracks not listened to in the last ${fetchInDays} days, the total period must be at least ${fetchInDays} days`))        
        }


        next()
    } catch (error: unknown) {

        if (error instanceof Error) {
            return next(error)
        }

        return next(new Error("Unexpected error"))
    }
}