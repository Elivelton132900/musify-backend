//  Rotas com proteção CSRF

// import { Request, Response, NextFunction } from "express";

// export function csrfProtection(req: Request, res: Response, next: NextFunction) {
//     // Apenas para métodos que modificam dados
//     const dangerousMethods = ["POST", "PUT", "PATCH", "DELETE"];
    
//     if (!dangerousMethods.includes(req.method)) {
//         return next();
//     }
    
//     const csrfCookie = req.cookies.csrf_token;
//     const csrfHeader = req.headers["x-csrf-token"];
    
//     if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
//         return res.status(403).json({
//             error: "Invalid CSRF token",
//             message: "Possible CSRF attack detected"
//         });
//     }
    
//     next();
// }

// APLICAR NAS ROTAS A PROTEÇÃO ONDE TEM DANGEROUSMETHOD