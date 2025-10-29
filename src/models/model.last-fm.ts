import { Joi } from "celebrate";

export interface ParamsHashMD5GetSession {
    api_key: string | ""
    method: "auth.getSession",
    token: string | ""
}
export const loginSchema = Joi.object().keys({
    token: Joi.string().trim().required()
})
