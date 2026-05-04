<?php

namespace App\Db;

class Connection
{
    public function fetchOne(string $sql, array $params = []): ?array { return null; }
    public function execute(string $sql): void {}
}
