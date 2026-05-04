<?php

namespace App\Repository;

use App\Model\User;
use App\Db\Connection;

class UserRepository extends BaseRepository
{
    private Connection $connection;

    public function __construct(Connection $connection)
    {
        $this->connection = $connection;
    }

    public function findById(int $id): ?User
    {
        $row = $this->connection->fetchOne('SELECT * FROM users WHERE id = ?', [$id]);
        return $row ? new User($row) : null;
    }

    public function save(User $user): void
    {
        $this->connection->execute('INSERT INTO users ...');
    }
}
