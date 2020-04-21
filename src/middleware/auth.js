import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } from "../../config/dev";

const User = mongoose.model("User");

/**
 * Generate JWT Auth Tokens
 */
export const createTokens = (user) => {
    const refreshToken = jwt.sign({ userId: user.id, _jwt_version: user.count }, REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
    const accessToken = jwt.sign({ userId: user.id }, ACCESS_TOKEN_SECRET, { expiresIn: "15m" });

    return { refreshToken, accessToken };
};

/**
 * JWT AUTH MIDDLEWARE
 *
 * This function will generate an access token and refresh token.
 * HEADS UP: if you invalidate the tokens by incrementing the "User.count" field you'll still
 * need to wait the accessToken expiration time before it'll reach that check in the code.
 */
export const authJWT = async (req, res, next) => {
    const refreshToken = req.cookies["refresh-token"];
    const accessToken = req.cookies["access-token"];

    // NO TOKENS (not logged in)
    // If no tokens call next middleware WITHOUT userId
    if (!refreshToken && !accessToken) {
        return next();
    }

    // ACCESS TOKEN IS GOOD
    // If ACCESS token hasn't been tampered with or expired call next middleware WITH userId
    try {
        const data = jwt.verify(accessToken, ACCESS_TOKEN_SECRET);
        req.userId = data.userId;
        return next();
    } catch {}

    // MISSING REFRESH TOKEN
    // If no refresh token call next middleware WITHOUT userId
    if (!refreshToken) {
        return next();
    }

    let data;

    // REFRESH TOKEN IS GOOD
    try {
        data = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    } catch {
        return next();
    }

    const user = await User.findById(data.userId);
    // TOKEN HAS BEEN INVALIDATED ON PURPOSE
    if (!user || user._jwt_version !== data._jwt_version) {
        return next();
    }

    // ALL TOKENS ARE GOOD - GENERATE NEW TOKENS TO RESET EXPIRATIONS
    // ADD USER ID TO REQ OBJECT
    const tokens = createTokens(user);
    res.cookie("refresh-token", tokens.refreshToken);
    res.cookie("access-token", tokens.accessToken);
    req.userId = data.userId;

    // SUCCESSFUL AUTHENTICATION
    // call next middleware WITH new tokens and userId
    next();
};
