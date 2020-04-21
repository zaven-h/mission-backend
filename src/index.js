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

app.use(
    cors({
        origin: "http://localhost:3000",
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
    app.listen(8080, () => {
        console.log(`🚀 Server running on http://localhost:8080${server.graphqlPath}`);
    });
} catch (error) {
    console.error(error);
}
