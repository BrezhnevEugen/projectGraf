<?php

namespace App\Model;

class User
{
    public int $id;
    public string $email;

    public function __construct(array $row)
    {
        $this->id = (int) $row['id'];
        $this->email = $row['email'];
    }
}
