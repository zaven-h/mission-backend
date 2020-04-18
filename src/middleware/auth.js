import jwt from "express-jwt";
import { jwtSecret } from "../../config/keys";

// auth middleware
export const authJWT = jwt({
    secret: jwtSecret,
    credentialsRequired: false,
});
