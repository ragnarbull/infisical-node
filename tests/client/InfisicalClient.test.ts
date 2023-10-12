require('dotenv').config();
import { describe, expect } from '@jest/globals';
import InfisicalClient from '../../src';

describe('InfisicalClient', () => {
    let client: InfisicalClient;
    beforeAll(async () => {
        client = new InfisicalClient({
            token: process.env.INFISICAL_TOKEN!,
            tokenJson: process.env.INFISICAL_TOKEN_JSON!,
            siteURL: process.env.SITE_URL!,
            debug: true
        });
        await client.createSecret('KEY_ONE', 'KEY_ONE_VAL');
        await client.createSecret('KEY_ONE', 'KEY_ONE_VAL_PERSONAL', {
            type: "personal",
            environment: "dev",
            path: "/"
        });
        await client.createSecret('KEY_TWO', 'KEY_TWO_VAL');
        await client.createSecret("NESTED_SECRET_1", "${NESTED_SECRET_2}");
        await client.createSecret("NESTED_SECRET_2", "${NESTED_SECRET_3}");
        await client.createSecret("NESTED_SECRET_3", "DEEPLY_NESTED_SECRET");
        await client.createSecret("PROTOCOL", "https");
        await client.createSecret("DOMAIN", "www.infisical.com");
        await client.createSecret("FULL_HOST", "${PROTOCOL}://${DOMAIN}");
    }, 20000);

    afterAll(async () => {
        await client.deleteSecret('KEY_ONE');
        await client.deleteSecret('KEY_TWO');
        await client.deleteSecret('KEY_THREE');
        await client.deleteSecret('NESTED_SECRET_1');
        await client.deleteSecret('NESTED_SECRET_2');
        await client.deleteSecret('NESTED_SECRET_3');
        await client.deleteSecret('PROTOCOL');
        await client.deleteSecret('DOMAIN');
        await client.deleteSecret('FULL_HOST');
    }, 20000);

    it('get overriden personal secret', async () => {
        const secret = await client.getSecret('KEY_ONE', {
            type: "personal",
            environment: "dev",
            path: "/"
        });

        expect(secret.secretName).toBe('KEY_ONE');
        expect(secret.secretValue).toBe('KEY_ONE_VAL_PERSONAL');
        expect(secret.type).toBe('personal');
    });

    it('get shared secret specified', async () => {
        const secret = await client.getSecret('KEY_ONE', {
            type: 'shared',
            environment: "dev",
            path: "/"
        });

        expect(secret.secretName).toBe('KEY_ONE');
        expect(secret.secretValue).toBe('KEY_ONE_VAL');
        expect(secret.type).toBe('shared');
    });

    it('get shared secret', async () => {
        const secret = await client.getSecret('KEY_TWO');

        expect(secret.secretName).toBe('KEY_TWO');
        expect(secret.secretValue).toBe('KEY_TWO_VAL');
        expect(secret.type).toBe('shared');
    });

    it('create shared secret', async () => {
        const secret = await client.createSecret('KEY_THREE', 'KEY_THREE_VAL');

        expect(secret.secretName).toBe('KEY_THREE');
        expect(secret.secretValue).toBe('KEY_THREE_VAL');
        expect(secret.type).toBe('shared');
    });

    it('create personal secret', async () => {
        await client.createSecret('KEY_FOUR', 'KEY_FOUR_VAL');
        const secretPersonal = await client.createSecret('KEY_FOUR', 'KEY_FOUR_VAL_PERSONAL', {
            type: "personal",
            environment: "dev",
            path: "/"
        });

        expect(secretPersonal.secretName).toBe('KEY_FOUR');
        expect(secretPersonal.secretValue).toBe('KEY_FOUR_VAL_PERSONAL');
        expect(secretPersonal.type).toBe('personal');
    });

    it('update shared secret', async () => {
        const secret = await client.updateSecret('KEY_THREE', 'FOO');

        expect(secret.secretName).toBe('KEY_THREE');
        expect(secret.secretValue).toBe('FOO');
        expect(secret.type).toBe('shared');
    });

    it('update personal secret', async () => {
        const secret = await client.updateSecret('KEY_FOUR', 'BAR', {
            type: "personal",
            environment: "dev",
            path: "/"
        });

        expect(secret.secretName).toBe('KEY_FOUR');
        expect(secret.secretValue).toBe('BAR');
        expect(secret.type).toBe('personal');
    });

    it('delete personal secret', async () => {
        const secret = await client.deleteSecret('KEY_FOUR', {
            type: "personal",
            environment: "dev",
            path: "/"
        });

        expect(secret.secretName).toBe('KEY_FOUR');
        expect(secret.secretValue).toBe('BAR');
        expect(secret.type).toBe('personal');
    });

    it('delete shared secret', async () => {
        const secret = await client.deleteSecret('KEY_FOUR');

        expect(secret.secretName).toBe('KEY_FOUR');
        expect(secret.secretValue).toBe('KEY_FOUR_VAL');
        expect(secret.type).toBe('shared');
    });

    it('Fetch nested shared secrets', async () => {
        const secrets = await client.getAllSecrets({ environment: "dev", path: "/", attachToProcessEnv: false, includeImports: true });

        const expectedValues = [
            'DEEPLY_NESTED_SECRET',
            'https',
            'www.infisical.com',
            'https://www.infisical.com'
        ];

        for (const expectedValue of expectedValues) {
            const count = secrets.filter(secret => secret.secretValue === expectedValue).length;
            if (expectedValue === 'DEEPLY_NESTED_SECRET') {
                expect(count).toBe(3);
            } else {
                expect(count).toBe(1);
            }
        }
    });

    it('attach all to process.env', async () => {
        // note: getAllSecrets returns dupliate shared + personal ones at the moment,
        // should it default to personal?
        // const secretBundles = await client.getAllSecrets({
        //     environment: "dev",
        //     path: "/",
        //     attachToProcessEnv: true,
        //     includeImports: false
        // });

        // can't test this because both key are same, only type is diff 
        // secretBundles.forEach((secretBundle) => {
        //     expect(process.env[secretBundle.secretName]).toBe(secretBundle.secretValue);
        // });
    });

    it('encrypt/decrypt symmetric', () => {
        const plaintext = 'The quick brown fox jumps over the lazy dog';

        const key = client.createSymmetricKey();

        const {
            ciphertext,
            iv,
            tag
        } = client.encryptSymmetric(plaintext, key);

        const cleartext = client.decryptSymmetric(
            ciphertext,
            key,
            iv,
            tag
        );

        expect(plaintext).toBe(cleartext);
    });
});