import express from "express";
import mongoose from "mongoose";

import { MongoKeys } from "../config/keys";

import "./models";

import { ApolloServer } from "apollo-server-express";

import typeDefs from "./schema";
import resolvers from "./resolvers";

import { authJWT } from "./middleware/auth";

/**
 * Setup DB Connection
 */
mongoose.connect(MongoKeys.URI, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
});
var db = mongoose.connection;
db.on("error", console.error.bind(console, "MONGO CONNECTION ERROR:"));
db.once("open", () => console.log("--> db connected"));

/**
 * Setup Apollo Server
 */
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
        console.log(req.user);
        return {
            user: req.user,
        };
    },
});

/**
 * Setup Express
 */
const app = express();

const GRAPHQL_URL = "/graphql";

app.use(GRAPHQL_URL, authJWT);

server.applyMiddleware({ app, path: GRAPHQL_URL });

/**
 * Start Server
 */
try {
    app.listen(8080, () => {
        console.log(`🚀 Server running on http://localhost:8080${server.graphqlPath}`);
    });
} catch (error) {
    console.error(error);
}
