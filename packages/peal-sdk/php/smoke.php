<?php

// The smoke test, which scripts/test.ts runs against a stand-in API: the
// health check, the credential check with a bearer token, and the error a
// refused token raises.

require __DIR__ . '/vendor/autoload.php';

use Peal\Exceptions\PealApiException;
use Peal\PealClient;

$baseUrl = getenv('PEAL_API_URL');
$peal = new PealClient(token: 'peal_test', options: ['baseUrl' => $baseUrl]);

$peal->system->health();
$credential = $peal->credential->get();

if (!$credential->isApiKey()) {
    throw new RuntimeException('Unexpected answer: ' . $credential);
}

$key = $credential->asApiKey();

if (
    $key->workspace->name !== 'Studio'
    || $key->expiresAt !== null
    || $key->start !== null
    || !in_array('post:schedule', $key->permissions, true)
) {
    throw new RuntimeException('Unexpected answer: ' . $credential);
}

try {
    (new PealClient(token: 'refused', options: ['baseUrl' => $baseUrl]))->credential->get();
    throw new RuntimeException('A refused token got an answer');
} catch (PealApiException $error) {
    if ($error->getCode() !== 401) {
        throw $error;
    }
}

echo "ok\n";
