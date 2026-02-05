import test from 'node:test'
import assert from 'node:assert'
import { buildApp } from '../app.js'


// Vérifie que la page d'accueil ce lance correctement
test('GET / responds with a page', async () => {
    const app = await buildApp()

    const response = await app.inject({
        method: 'GET',
        url: '/'
    })

    console.log('Response status:', response.statusCode);
    assert.strictEqual(response.statusCode, 200)
    assert.match(response.body, /<html/i) // Basic check for HTML content
    assert.match(response.body, /Quotes/i) // Check for some expected content

    await app.close()
})

// Vérifie que l'ajout d'une quote fonctionnement et rédige correctement
test('POST /quotes adds a quote and redirects', async () => {
    const app = await buildApp()

    // Note: This test will fail if DB is not available or configured correctly
    // Ideally we should mock the DB or have a dedicated test DB.
    // For this exercise, we assume the environment is set up.

    const response = await app.inject({
        method: 'POST',
        url: '/quotes',
        payload: {
            author: 'Test Author',
            text: 'Test Quote'
        }
    })

    assert.strictEqual(response.statusCode, 302)
    assert.strictEqual(response.headers.location, '/')

    await app.close()
})