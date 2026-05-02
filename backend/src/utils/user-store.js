const fs = require('fs/promises');
const path = require('path');

const USERS_FILE_PATH = path.join(__dirname, '..', 'data', 'users.json');

const DEFAULT_USERS = [
    {
        id: 'user-1',
        username: 'admin',
        passwordHash: '$2b$10$YJlXuNV.PrL0HvGNDJ0yre6eP7.KuLLQnl6tQvQ0X7L5JH8vvFSm2',
        fullName: 'Admin User',
        email: 'admin@example.com',
        role: 'ADMIN',
        active: true,
        lastLoginAt: null,
    },
    {
        id: 'user-2',
        username: 'operator',
        passwordHash: '$2b$10$YJlXuNV.PrL0HvGNDJ0yre6eP7.KuLLQnl6tQvQ0X7L5JH8vvFSm2',
        fullName: 'Operator User',
        email: 'operator@example.com',
        role: 'OPERATOR',
        active: true,
        lastLoginAt: null,
    },
];

const ensureUsersFile = async () => {
    try {
        await fs.access(USERS_FILE_PATH);
    } catch (error) {
        await fs.mkdir(path.dirname(USERS_FILE_PATH), { recursive: true });
        await fs.writeFile(USERS_FILE_PATH, JSON.stringify(DEFAULT_USERS, null, 2), 'utf8');
    }
};

const readUsers = async () => {
    await ensureUsersFile();
    const raw = await fs.readFile(USERS_FILE_PATH, 'utf8');
    const users = JSON.parse(raw);

    if (!Array.isArray(users)) {
        throw new Error('users.json must contain an array of users');
    }

    return users;
};

const writeUsers = async (users) => {
    await fs.mkdir(path.dirname(USERS_FILE_PATH), { recursive: true });
    await fs.writeFile(USERS_FILE_PATH, JSON.stringify(users, null, 2), 'utf8');
};

const findUserByUsername = async (username) => {
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';

    if (!normalizedUsername) {
        return null;
    }

    const users = await readUsers();
    return users.find((user) => user.username === normalizedUsername) || null;
};

const findUserById = async (userId) => {
    if (!userId) {
        return null;
    }

    const users = await readUsers();
    return users.find((user) => user.id === userId) || null;
};

const updateUserLastLogin = async (userId) => {
    if (!userId) {
        return null;
    }

    const users = await readUsers();
    const userIndex = users.findIndex((user) => user.id === userId);

    if (userIndex === -1) {
        return null;
    }

    const updatedUser = {
        ...users[userIndex],
        lastLoginAt: new Date().toISOString(),
    };

    users[userIndex] = updatedUser;
    await writeUsers(users);

    return updatedUser;
};

module.exports = {
    findUserByUsername,
    findUserById,
    readUsers,
    updateUserLastLogin,
    writeUsers,
};
