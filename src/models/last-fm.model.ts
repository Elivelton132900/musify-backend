import { Joi } from 'celebrate';

export const limitToFetchSchema = Joi.object().keys({
    limit: Joi.number().integer().min(10).required()

})