<?php

namespace App\Repository;

abstract class BaseRepository
{
    abstract public function findById(int $id);
}
