import mongoose from "mongoose";

const { Schema } = mongoose;

const OrgSchema = new Schema({
    properties: {
        name: String,
    },
    creator: { type: Schema.Types.ObjectId, ref: "User" },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    managers: [{ type: Schema.Types.ObjectId, ref: "User" }],
});

mongoose.model("Org", OrgSchema);
