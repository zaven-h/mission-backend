import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { AuthenticationError, UserInputError } from "apollo-server-express";
import { createTokens } from "../middleware/auth";

const User = mongoose.model("User");
const Org = mongoose.model("Org");
const Task = mongoose.model("Task");
const Role = mongoose.model("Role");

const requireAuthentication = (req) => {
    if (!req.userId) {
        throw new AuthenticationError("User is not authenticated");
    }
};

export default {
    Query: {
        async currentUser(_, __, { req }) {
            requireAuthentication(req);

            return await User.findById(req.userId);
        },
        async org(_, { orgId }, { req }) {
            requireAuthentication(req);

            return await Org.findById(orgId);
        },
        async users(_, ___, { req }) {
            requireAuthentication(req);

            return await User.find({}).exec();
        },
        async orgs(_, args, { req }) {
            requireAuthentication(req);

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
        async tasks(_, args, { req }) {
            requireAuthentication(req);

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
        async getTaskTree(obj, { orgId, includePrivate }, { req }) {
            requireAuthentication(req);

            /**
             * Steps to retrieve node tree:
             * - get only the root nodes
             * - get the children of each root node and add to an array on each root node
             * - unwind the children arrays (lots of duplicate root nodes)
             * - populate all fields of children nodes
             * - remove duplicate root nodes
             */
            const roots = await Task.aggregate([
                // Get the root nodes (tasks with no parent)
                {
                    $match: {
                        org: mongoose.Types.ObjectId(orgId),
                        parent: {
                            $exists: false,
                        },
                    },
                },
                // Get the children of each root task. This will add a
                // "children" array to the document including all
                // descendant tasks.
                {
                    $graphLookup: {
                        from: "tasks",
                        startWith: "$_id",
                        connectFromField: "_id",
                        connectToField: "parent",
                        as: "children",
                    },
                },
                // Unwind the "children" array. This will create a duplicate root document for
                // each child in the array and promote that child task to an object without the array.
                // Later, you will need to remove the duplicate root nodes. But, this is the only way
                // I found to do the lookups on nested documents. Lookups on nested array documents doesn't
                // appear to have a syntax to achieve. Now we can do lookups on the children fields
                {
                    $unwind: {
                        path: "$children",
                        preserveNullAndEmptyArrays: true,
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
                        preserveNullAndEmptyArrays: true,
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
                rootNode.children.forEach((childNode) => {
                    if ("_id" in childNode) {
                        allTasks.push(childNode);
                    }
                });
                // allTasks.push(...rootNode.children);
                delete rootNode.children;
                allTasks.push(rootNode);
            });
            // console.log(allTasks);
            return allTasks;
        },
    },
    Mutation: {
        async signup(_, { email, password, password2 }, context) {
            if (password !== password2) {
                throw new UserInputError("Passwords do not match");
            }

            const existingUser = await User.findOne({ email: email });
            if (existingUser) {
                throw new UserInputError("A user with this email already exists.");
            }

            const user = await User.create({
                email,
                password: await bcrypt.hash(password, 10),
            });

            if (!user) {
                throw new UserInputError("User could not be created. Dunno what happend.");
            }

            return true;
        },
        async login(_, { email, password }, context) {
            const user = await User.findOne({ email: email });
            if (!user) {
                throw new UserInputError("No user found with that email");
            }

            const valid = await bcrypt.compare(password, user.password);
            if (!valid) {
                throw new UserInputError("Incorrect password");
            }

            const { refreshToken, accessToken } = createTokens(user);

            context.res.cookie("refresh-token", refreshToken);
            context.res.cookie("access-token", accessToken);

            return user;
        },
        async logout(_, __, context) {
            context.res.clearCookie('refresh-token');
            context.res.clearCookie('access-token');
            return true;
        },
        async invalidateTokens(_, __, { req }) {
            if (!req.userId) {
                return false;
            }

            const user = await User.findOneAndUpdate({ _id: req.userId }, { $inc: { _jwt_version: 1 } });
            if (!user) {
                return false;
            }

            return true;
        },
        async createOrg(obj, { name }, { req }) {
            requireAuthentication(req);

            const org = new Org({ creator: req.userId });
            org.properties.name = name;
            org.managers.push(req.userId);
            await org.save();

            return org;
        },
        async addTask(obj, { name, parent, orgId, isPrivate }, { req }) {
            requireAuthentication(req);

            const task = new Task({ org: orgId, creator: req.userId });
            task.properties.name = name;
            task.properties.isPrivate = isPrivate || false;

            if (parent !== "") {
                task.parent = parent;
            }
            await task.save();

            return task;
        },
        async addTaskWatcher(obj, { userId, taskId }, { req }) {
            requireAuthentication(req);

            const result = await Task.updateOne({ _id: taskId }, { $push: { watchers: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async removeTaskWatcher(obj, { userId, taskId }, { req }) {
            requireAuthentication(req);

            const result = await Task.updateOne({ _id: taskId }, { $pull: { watchers: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async addTaskAssignee(obj, { userId, taskId }, { req }) {
            requireAuthentication(req);

            const result = await Task.updateOne({ _id: taskId }, { $push: { assignees: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async removeTaskAssignee(obj, { userId, taskId }, { req }) {
            requireAuthentication(req);

            const result = await Task.updateOne({ _id: taskId }, { $pull: { assignees: userId } });
            return {
                numMatched: result.n,
                numModified: result.nModified,
            };
        },
        async updateTaskProperties(obj, { taskId, properties }, { req }) {
            requireAuthentication(req);

            const result = await Task.findOne({ _id: taskId });
            result.properties = { ...result.properties, ...properties };
            return await result.save();
        },
    },
};
