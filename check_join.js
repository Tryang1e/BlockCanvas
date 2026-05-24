import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*, portfolios(*)')
    .eq('creator_name', 'Test') // Using capitalized 'Test' since that's their Display Name? wait, their creator_name is 'test' or 'Test'?
    .single()

  console.log('Result for Test:', JSON.stringify(profile, null, 2), error)
  
  const { data: profile2, error: err2 } = await supabase
    .from('profiles')
    .select('*, portfolios(*)')
    .eq('creator_name', 'test') 
    .single()

  console.log('Result for test:', JSON.stringify(profile2, null, 2), err2)
}

check()
