#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

// Read GEMINI_API_KEY from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf8')
const match = envContent.match(/GEMINI_API_KEY=(.+)/)
if (!match) { console.error('GEMINI_API_KEY not found in .env.local'); process.exit(1) }
const key = match[1].trim()

async function listModels() {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
  const data = await res.json()
  if (!res.ok) { console.error('Error:', data); process.exit(1) }

  const models = data.models
    .filter(m => m.supportedGenerationMethods?.includes('generateContent') ||
                 m.supportedGenerationMethods?.includes('streamGenerateContent'))
    .map(m => ({
      id: m.name.replace('models/', ''),
      displayName: m.displayName,
      methods: m.supportedGenerationMethods,
    }))

  console.log(`\nAvailable models for your key (${models.length} total):\n`)
  models.forEach(m => console.log(`  ${m.id.padEnd(45)} ${m.displayName}`))
  console.log()
}

listModels()
