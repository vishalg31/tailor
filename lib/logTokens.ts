import fs from 'fs'
import path from 'path'

interface TokenLog {
  route: string
  model: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

const CSV_PATH = path.join(process.cwd(), 'token-usage.csv')
const CSV_HEADER = 'timestamp,route,model,input_tokens,output_tokens,total_tokens\n'

export function logTokens({ route, model, inputTokens, outputTokens, totalTokens }: TokenLog) {
  const label = `[${route}] tokens — input: ${inputTokens}, output: ${outputTokens}, total: ${totalTokens} (model: ${model})`
  console.log(label)

  if (process.env.NODE_ENV !== 'development') return

  try {
    if (!fs.existsSync(CSV_PATH)) {
      fs.writeFileSync(CSV_PATH, CSV_HEADER)
    }
    const row = `${new Date().toISOString()},${route},${model},${inputTokens},${outputTokens},${totalTokens}\n`
    fs.appendFileSync(CSV_PATH, row)
  } catch {
    // non-critical — don't crash the request
  }
}
