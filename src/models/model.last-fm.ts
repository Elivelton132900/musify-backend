import { Joi } from "celebrate";

export interface ParamsHash {
    api_key: string | ""
    method: "auth.getSession",
    token: string | "",
}

export interface lastFmSession {
    token: string
}

export const loginSchema = Joi.object().keys({
    token: Joi.string().trim().required()
})
