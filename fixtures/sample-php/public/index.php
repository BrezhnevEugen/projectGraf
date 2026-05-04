<?php
require_once __DIR__ . '/../src/Db/Connection.php';
require_once __DIR__ . '/../src/Model/User.php';
require_once __DIR__ . '/../src/Repository/BaseRepository.php';
require_once __DIR__ . '/../src/Repository/UserRepository.php';

use App\Db\Connection;
use App\Repository\UserRepository;

$repo = new UserRepository(new Connection());
$user = $repo->findById(1);
