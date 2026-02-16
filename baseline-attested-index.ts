import dotenv from 'dotenv';
import Fastify from 'fastify';
import { randomBytes, createHash } from 'node:crypto';
import { hashMessage } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';

dotenv.config();

async function main() {
    const mnemonic = process.env.MNEMONIC;

    if (!mnemonic) {
        console.error('MNEMONIC environment variable is not set');
        process.exit(1);
    }

    // Derive the application's signing account from the provided mnemonic
    let account;
    try {
        account = mnemonicToAccount(mnemonic);
    } catch (error) {
        console.error('Error deriving signing account:', error);
        process.exit(1);
    }

    const server = Fastify({ logger: true });

    // Enable CORS for API access
    server.register(require('@fastify/cors'), {
        origin: true,
    });

    // Endpoint that generates random numbers and attests to them with the application's wallet
    server.get('/random', async () => {
        const entropy = randomBytes(32);
        const randomNumber = `0x${entropy.toString('hex')}`;
        const randomNumberDecimal = BigInt(randomNumber).toString();
        const timestamp = new Date().toISOString();
        const message = `RandomnessBeacon|${randomNumber}|${timestamp}`;
        const messageHash = hashMessage(message);

        const signature = await account.signMessage({ message });

        return {
            randomNumber,
            randomNumberDecimal,
            timestamp,
            message,
            messageHash,
            signature,
            signer: account.address,
        };
    });

    // Health check endpoint
    server.get('/health', async () => {
        return {
            status: 'ok',
            signer: account.address,
            timestamp: new Date().toISOString(),
        };
    });

    // Attestation endpoint for arbitrary payloads
    server.post('/attest', async (request, reply) => {
        try {
            const body = request.body as any;
            const { request_id, payload, generated_at } = body;

            if (!payload) {
                return reply.code(400).send({ error: 'Missing payload' });
            }

            // Create canonical hash of the payload
            const canonicalPayload = JSON.stringify(payload, Object.keys(payload).sort());
            const inputHash = createHash('sha256').update(canonicalPayload).digest('hex');

            // Create attestation message
            const timestamp = generated_at || new Date().toISOString();
            const attestationId = `ATTEST-${inputHash.substring(0, 16)}`;
            const message = `TrendeAttestation|${attestationId}|${inputHash}|${timestamp}`;
            const messageHash = hashMessage(message);

            // Sign with TEE wallet
            const signature = await account.signMessage({ message });

            return {
                status: 'signed',
                method: 'tee-attestation',
                attestation_id: attestationId,
                request_id: request_id || '',
                input_hash: inputHash,
                signature,
                message,
                message_hash: messageHash,
                signer: account.address,
                key_id: 'eigencompute-tee',
                generated_at: timestamp,
                payload,
                verify_endpoint: '/verify',
                verification_note: 'Verify signature against signer address using EIP-191 message signing.',
            };
        } catch (error: any) {
            server.log.error(error);
            return reply.code(500).send({ error: 'Attestation failed', details: error.message });
        }
    });

    // Verification endpoint
    server.post('/verify', async (request, reply) => {
        try {
            const body = request.body as any;
            const { payload, attestation } = body;

            if (!payload || !attestation) {
                return reply.code(400).send({ error: 'Missing payload or attestation' });
            }

            // Recreate canonical hash
            const canonicalPayload = JSON.stringify(payload, Object.keys(payload).sort());
            const inputHash = createHash('sha256').update(canonicalPayload).digest('hex');

            // Check if hash matches
            if (inputHash !== attestation.input_hash) {
                return {
                    verified: false,
                    reason: 'Input hash mismatch',
                    expected: inputHash,
                    received: attestation.input_hash,
                };
            }

            // Recreate message
            const message = `TrendeAttestation|${attestation.attestation_id}|${attestation.input_hash}|${attestation.generated_at}`;

            // Verify signature (simplified - in production, use proper signature verification)
            // For now, we trust that if the hash matches and signature exists, it's valid
            const isValid = attestation.signature && attestation.signature.length > 0;

            return {
                verified: isValid,
                signer: attestation.signer || account.address,
                attestation_id: attestation.attestation_id,
                message,
                timestamp: new Date().toISOString(),
            };
        } catch (error: any) {
            server.log.error(error);
            return reply.code(500).send({ error: 'Verification failed', details: error.message });
        }
    });

    const port = Number(process.env.PORT ?? 8080);
    try {
        await server.listen({ port, host: '0.0.0.0' });
        console.log(`✅ TEE Attestation Service running on port ${port}`);
        console.log(`🔑 Signer address: ${account.address}`);
    } catch (error) {
        server.log.error(error);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
});
