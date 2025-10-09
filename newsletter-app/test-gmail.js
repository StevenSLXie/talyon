// Test Gmail credentials locally
// Run with: node test-gmail.js

const nodemailer = require('nodemailer')

async function testGmail() {
  const gmailUser = process.env.GMAIL_USER || 'stevenslxie@gmail.com'
  const gmailPass = process.env.GMAIL_APP_PASSWORD || 'your-app-password-here'
  
  console.log('Testing Gmail credentials...')
  console.log('User:', gmailUser)
  console.log('Password length:', gmailPass.length)
  
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailUser,
      pass: gmailPass
    }
  })

  try {
    // Test connection
    await transporter.verify()
    console.log('✅ Gmail connection successful!')
    
    // Send test email
    await transporter.sendMail({
      from: `"Talyon Test" <${gmailUser}>`,
      to: gmailUser, // Send to yourself
      subject: 'Gmail Test - Talyon',
      text: 'This is a test email from Talyon Gmail integration.'
    })
    
    console.log('✅ Test email sent successfully!')
  } catch (error) {
    console.error('❌ Gmail test failed:', error.message)
    console.error('Error code:', error.code)
  }
}

testGmail()
