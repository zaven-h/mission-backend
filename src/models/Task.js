import mongoose, { Schema } from "mongoose";

const TaskSchema = new Schema({
    org: { type: Schema.Types.ObjectId, ref: "Org" },
    parent: { type: Schema.Types.ObjectId, ref: "Task" },
    creator: { type: Schema.Types.ObjectId, ref: "User" },
    watchers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    assignees: [{ type: Schema.Types.ObjectId, ref: "User" }],
    properties: {
        name: String,
        description: String,
        isPrivate: { type: Boolean },
    },
});

mongoose.model("Task", TaskSchema);
