<?php
require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/bootstrap/app.php';

$user = \Statamic\Auth\File\User::create([
    'name' => 'Admin',
    'email' => 'andris@varadi.tv',
    'password' => \Illuminate\Support\Facades\Hash::make('admin123'),
    'super' => true,
]);

$user->save();
echo "✅ Admin user created!\n";
echo "Email: andris@varadi.tv\n";
echo "Password: admin123\n";
