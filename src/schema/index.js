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

    type TaskUpdateResponse {
        numMatched: Int
        numModified: Int
    }

    type Query {
        currentUser: User
        users: [User!]
        org(orgId: String!): Org
        orgs: [Org]
        tasks: [Task]
        getTaskTree(orgId: String!, includePrivate: Boolean): [Task]
    }

    type Mutation {
        signup(email: String!, password: String!, password2: String!): String
        login(email: String!, password: String!): User
        invalidateTokens: Boolean
        createOrg(name: String!): Org
        addTask(name: String!, parent: String, orgId: String!, isPrivate: Boolean): Task
        updateTaskProperties(taskId: String!, properties: TaskInputProperties!): Task
        addTaskWatcher(userId: String!, taskId: String!): TaskUpdateResponse
        removeTaskWatcher(userId: String!, taskId: String!): TaskUpdateResponse
        addTaskAssignee(userId: String!, taskId: String!): TaskUpdateResponse
        removeTaskAssignee(userId: String!, taskId: String!): TaskUpdateResponse
    }
`;
