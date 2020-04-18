// import db from "./models";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jsonwebtoken from "jsonwebtoken";
import { jwtSecret } from "../../config/keys";

const User = mongoose.model("User");
const Org = mongoose.model("Org");
const Task = mongoose.model("Task");
const Role = mongoose.model("Role");

const requireAuthentication = ({ user }) => {
    if (!user) {
        throw new Error("You are not authenticated.");
    }
};

export default {
    Query: {
        async me(_, args, context) {
            requireAuthentication(context);

            // user is authenticated
            return await User.findById(context.user.id);
        },
        async users(_, args, context) {
            requireAuthentication(context);

            return await User.find({}).exec();
        },
        async orgs(_, args, context) {
            requireAuthentication(context);

            return await Org.aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "managers",
                        foreignField: "_id",
                        as: "managers",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "members",
                        foreignField: "_id",
                        as: "members",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "creator",
                        foreignField: "_id",
                        as: "creator",
                    },
                },
                {
                    $unwind: {
                        path: "$creator",
                        preserveNullAndEmptyArrays: true,
                    },
                },
            ]).exec();
        },
        async tasks(_, args, context) {
            requireAuthentication(context);

            return await Task.aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "creator",
                        foreignField: "_id",
                        as: "creator",
                    },
                },
                {
                    $unwind: {
                        path: "$creator",
                        preserveNullAndEmptyArrays: true,
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "watchers",
                        foreignField: "_id",
                        as: "watchers",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "assignees",
                        foreignField: "_id",
                        as: "assignees",
                    },
                },
            ]).exec();
        },
        async getTaskTree(obj, { org, includePrivate }, context) {
            requireAuthentication(context);

            const roots = await Task.aggregate([
                // Get the root nodes (no parent task)
                {
                    $match: {
                        org: mongoose.Types.ObjectId(org),
                        parent: {
                            $exists: false,
                        },
                    },
                },
                // Get the children of each root task
                {
                    $graphLookup: {
                        from: "tasks",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parent",
                        as: "children",
                    },
                },
                // unwind the children so each 'children' attribute is an object.
                // Now we can do lookups on the children fields
                {
                    $unwind: {
                        path: "$children",
                    },
                },
                // join the fields of child objects
                {
                    $lookup: {
                        from: "users",
                        localField: "children.creator",
                        foreignField: "_id",
                        as: "children.creator",
                    },
                },
                {
                    $unwind: {
                        path: "$children.creator",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "children.watchers",
                        foreignField: "_id",
                        as: "children.watchers",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "children.assignees",
                        foreignField: "_id",
                        as: "children.assignees",
                    },
                },
                // merge the duplicate root objects left from the original
                // children unwind
                {
                    $group: {
                        _id: "$_id",
                        properties: { $first: "$properties" },
                        watchers: { $first: "$watchers" },
                        assignees: { $first: "$assignees" },
                        org: { $first: "$org" },
                        creator: { $first: "$creator" },
                        children: { $push: "$children" },
                    },
                },
                // join the fields of the root nodes
                {
                    $lookup: {
                        from: "users",
                        localField: "creator",
                        foreignField: "_id",
                        as: "creator",
                    },
                },
                {
                    $unwind: {
                        path: "$creator",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "watchers",
                        foreignField: "_id",
                        as: "watchers",
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "assignees",
                        foreignField: "_id",
                        as: "assignees",
                    },
                },
            ]).exec();
            let allTasks = [];
            roots.forEach((rootNode) => {
                allTasks.push(...rootNode.children);
                delete rootNode.children;
                allTasks.push(rootNode);
            });
            // console.log(allTasks);
            return allTasks;
        },
    },
    Mutation: {
        async signup(_, { email, password }, context) {
            const user = await User.create({
                email,
                password: await bcrypt.hash(password, 10),
            });

            return jsonwebtoken.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: "1d" });
        },
        async login(_, { email, password }, context) {
            const user = await User.findOne({ email: email });

            if (!user) {
                throw new Error("No user found with that email");
            }

            const valid = await bcrypt.compare(password, user.password);

            if (!valid) {
                throw new Error("Incorrect password");
            }

            // return json web token
            return jsonwebtoken.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: "1d" });
        },
        async createOrg(obj, { name }, context) {
            requireAuthentication(context);

            const org = new Org({ creator: context.user.id });
            org.properties.name = name;
            org.managers.push(context.user.id);
            await org.save();

            return org;
        },
        async addTask(obj, { name, parent, org, isPrivate }, context) {
            requireAuthentication(context);

            const task = new Task({ org: org, creator: context.user.id });
            task.properties.name = name;
            task.properties.isPrivate = isPrivate || false;

            if (parent !== "") {
                task.parent = parent;
            }
            await task.save();

            return task;
        },
        async addTaskWatcher(obj, { userId, taskId }, context) {
            requireAuthentication(context);

            const result = await Task.updateOne({ _id: taskId }, { $push: { watchers: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async removeTaskWatcher(obj, { userId, taskId }, context) {
            requireAuthentication(context);

            const result = await Task.updateOne({ _id: taskId }, { $pull: { watchers: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async addTaskAssignee(obj, { userId, taskId }, context) {
            requireAuthentication(context);

            const result = await Task.updateOne({ _id: taskId }, { $push: { assignees: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async removeTaskAssignee(obj, { userId, taskId }, context) {
            requireAuthentication(context);

            const result = await Task.updateOne({ _id: taskId }, { $pull: { assignees: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async updateTaskProperties(obj, { taskId, properties }, context) {
            requireAuthentication(context);

            const result = await Task.findOne({ _id: taskId });
            result.properties = { ...result.properties, ...properties };
            return await result.save();
        },
    },
};
