import { gql } from "apollo-server-express";

export default gql`
    type User {
        _id: String!
        email: String!
    }

    type OrgProperties {
        name: String!
    }

    type Org {
        _id: ID!
        properties: OrgProperties!
        creator: User
        members: [User]
        managers: [User]
    }

    type TaskProperties {
        name: String
        description: String
        isPrivate: Boolean
    }

    input TaskInputProperties {
        name: String
        description: String
        isPrivate: Boolean
    }

    type Task {
        _id: ID!
        parent: String
        creator: User!
        properties: TaskProperties!
        watchers: [User]!
        assignees: [User]!
        # children: [Task]
    }

    type UpdateResponse {
        numMatched: Int
        numModified: Int
    }

    type Query {
        me: User
        users: [User!]
        orgs: [Org]
        tasks: [Task]
        getTaskTree(org: String!, includePrivate: Boolean): [Task]
    }

    type Mutation {
        signup(email: String!, password: String!): String
        login(email: String!, password: String!): User
        invalidateTokens: Boolean
        createOrg(name: String!): Org
        addTask(name: String!, parent: String, org: String!, isPrivate: Boolean): Task
        addTaskWatcher(userId: String!, taskId: String!): UpdateResponse
        removeTaskWatcher(userId: String!, taskId: String!): UpdateResponse
        addTaskAssignee(userId: String!, taskId: String!): UpdateResponse
        removeTaskAssignee(userId: String!, taskId: String!): UpdateResponse
        updateTaskProperties(taskId: String!, properties: TaskInputProperties!): Task
    }
`;
