import { ApolloServer } from "apollo-server-express";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

import { MongoKeys } from "../config/keys";
import "./models";
import resolvers from "./resolvers";
import typeDefs from "./schema";
import { authJWT } from "./middleware/auth";

/**
 * Setup DB Connection
 */
mongoose.connect(MongoKeys.URI, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useFindAndModify: false,
});
var db = mongoose.connection;
db.on("error", console.error.bind(console, "MONGO CONNECTION ERROR:"));
db.once("open", () => console.log("--> db connected"));

/**
 * Setup Express
 */
const app = express();

/**
 * Setup CORS policy
 * TODO Fix SSL Certs on host so I can disable http to backend
 */
let allowedOrigins = [undefined, "http://localhost:3000", "http://localhost:8080"];
if (process.env.NODE_ENV === "production") {
    allowedOrigins = ["http://mission-frontend.herokuapp.com", "https://mission-frontend.herokuapp.com"];
}
app.use(
    cors({
        origin: (origin, callback) => {
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error(`Origin not allowed by CORS: ${origin}`));
            }
        },
        credentials: true,
    })
);

app.use(cookieParser());

app.use(authJWT);

/**
 * Setup Apollo Server
 */
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req, res }) => ({ req, res }),
    cors: false,
});

const GRAPHQL_URL = "/graphql";

// app.use(GRAPHQL_URL, authJWT);
server.applyMiddleware({ app, path: GRAPHQL_URL, cors: false });

/**
 * Start Server
 */
try {
    if (process.env.NODE_ENV === "production") {
        app.listen({ port: process.env.PORT || 8080 }, () => {
            console.log(`🚀 Server running on http://mission-backend.herokuapp.com:${process.env.PORT}${server.graphqlPath}`);
        });
    } else {
        app.listen({ port: 8080 }, () => {
            console.log(`🚀 Server running on http://localhost:8080${server.graphqlPath}`);
        });
    }
} catch (error) {
    console.error(error);
}
