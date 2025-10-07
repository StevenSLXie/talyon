// Currency and Salary Unit Converter
// Handles conversion between different currencies and salary units (monthly/yearly)

export interface SalaryAmount {
  amount: number
  currency: string
  period: 'monthly' | 'yearly' | 'hourly' | 'daily'
}

export interface ConvertedSalary {
  amount: number
  currency: string
  period: 'monthly' | 'yearly'
  original: SalaryAmount
}

// Exchange rates (as of 2024 - these should be updated regularly)
const EXCHANGE_RATES: Record<string, number> = {
  'SGD': 1.0,      // Singapore Dollar (base)
  'USD': 1.35,     // US Dollar
  'EUR': 1.47,     // Euro
  'GBP': 1.71,     // British Pound
  'HKD': 0.17,     // Hong Kong Dollar
  'JPY': 0.009,    // Japanese Yen
  'KRW': 0.001,    // Korean Won
  'CNY': 0.19,     // Chinese Yuan
  'AUD': 0.89,     // Australian Dollar
  'CAD': 0.99,     // Canadian Dollar
  'INR': 0.016,    // Indian Rupee
  'MYR': 0.29,     // Malaysian Ringgit
  'THB': 0.037,    // Thai Baht
  'IDR': 0.000086, // Indonesian Rupiah
  'PHP': 0.024,    // Philippine Peso
  'VND': 0.000055, // Vietnamese Dong
}

// Working hours and days per year (Singapore context)
const WORKING_HOURS_PER_DAY = 8
const WORKING_DAYS_PER_MONTH = 22
const MONTHS_PER_YEAR = 12

export class CurrencyConverter {
  /**
   * Convert salary to SGD monthly equivalent
   */
  static convertToSGDMonthly(salary: SalaryAmount): ConvertedSalary {
    let amountInSGD = salary.amount
    
    // Convert currency to SGD
    if (salary.currency.toUpperCase() !== 'SGD') {
      const rate = EXCHANGE_RATES[salary.currency.toUpperCase()]
      if (rate) {
        amountInSGD = salary.amount * rate
      } else {
        console.warn(`Unknown currency: ${salary.currency}`)
        // Default to 1:1 if unknown currency
        amountInSGD = salary.amount
      }
    }
    
    // Convert period to monthly
    let monthlyAmount = amountInSGD
    switch (salary.period) {
      case 'yearly':
        monthlyAmount = amountInSGD / MONTHS_PER_YEAR
        break
      case 'hourly':
        monthlyAmount = amountInSGD * WORKING_HOURS_PER_DAY * WORKING_DAYS_PER_MONTH
        break
      case 'daily':
        monthlyAmount = amountInSGD * WORKING_DAYS_PER_MONTH
        break
      case 'monthly':
        monthlyAmount = amountInSGD
        break
      default:
        console.warn(`Unknown period: ${salary.period}`)
        monthlyAmount = amountInSGD
    }
    
    return {
      amount: Math.round(monthlyAmount),
      currency: 'SGD',
      period: 'monthly',
      original: salary
    }
  }
  
  /**
   * Convert salary to SGD yearly equivalent
   */
  static convertToSGDYearly(salary: SalaryAmount): ConvertedSalary {
    const monthly = this.convertToSGDMonthly(salary)
    return {
      amount: Math.round(monthly.amount * MONTHS_PER_YEAR),
      currency: 'SGD',
      period: 'yearly',
      original: salary
    }
  }
  
  /**
   * Parse salary string and convert to structured format
   * Handles formats like: "$5000/month", "S$8000", "HK$15000/year", "€60000 annually"
   */
  static parseSalaryString(salaryStr: string): SalaryAmount | null {
    if (!salaryStr || typeof salaryStr !== 'string') return null
    
    const cleanStr = salaryStr.trim().toLowerCase()
    
    // Extract currency
    let currency = 'SGD' // default
    const currencyMatch = cleanStr.match(/([a-z]{3}|\$|€|£|¥|₹)/i)
    if (currencyMatch) {
      const symbol = currencyMatch[1].toUpperCase()
      switch (symbol) {
        case '$':
          // Determine if USD or SGD based on context
          currency = cleanStr.includes('usd') || cleanStr.includes('us') ? 'USD' : 'SGD'
          break
        case '€':
          currency = 'EUR'
          break
        case '£':
          currency = 'GBP'
          break
        case '¥':
          currency = 'JPY'
          break
        case '₹':
          currency = 'INR'
          break
        default:
          currency = symbol
      }
    }
    
    // Extract amount
    const amountMatch = cleanStr.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/)
    if (!amountMatch) return null
    
    const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
    
    // Extract period
    let period: 'monthly' | 'yearly' | 'hourly' | 'daily' = 'monthly' // default
    if (cleanStr.includes('year') || cleanStr.includes('annually') || cleanStr.includes('annual')) {
      period = 'yearly'
    } else if (cleanStr.includes('hour') || cleanStr.includes('hr')) {
      period = 'hourly'
    } else if (cleanStr.includes('day') || cleanStr.includes('daily')) {
      period = 'daily'
    } else if (cleanStr.includes('month') || cleanStr.includes('monthly')) {
      period = 'monthly'
    }
    
    return {
      amount,
      currency,
      period
    }
  }
  
  /**
   * Convert salary range string to SGD monthly range
   */
  static convertSalaryRange(rangeStr: string): { min: number; max: number; currency: string } | null {
    if (!rangeStr) return null
    
    // Handle ranges like "$5000-$8000", "S$6000-10000", "HK$15000-20000/year"
    const rangeMatch = rangeStr.match(/([a-z]{3}|\$|€|£|¥|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)\s*[-–—]\s*([a-z]{3}|\$|€|£|¥|₹)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?:\s*\/\s*(year|month|hour|day))?/i)
    
    if (!rangeMatch) return null
    
    const [, currency1, minStr, , maxStr, period] = rangeMatch
    
    const minAmount = parseFloat(minStr.replace(/,/g, ''))
    const maxAmount = parseFloat(maxStr.replace(/,/g, ''))
    
    // Determine currency
    let currency = 'SGD'
    if (currency1) {
      const symbol = currency1.toUpperCase()
      switch (symbol) {
        case '$':
          currency = 'SGD'
          break
        case '€':
          currency = 'EUR'
          break
        case '£':
          currency = 'GBP'
          break
        case '¥':
          currency = 'JPY'
          break
        case '₹':
          currency = 'INR'
          break
        default:
          currency = symbol
      }
    }
    
    // Determine period
    let salaryPeriod: 'monthly' | 'yearly' | 'hourly' | 'daily' = 'monthly'
    if (period) {
      switch (period.toLowerCase()) {
        case 'year':
          salaryPeriod = 'yearly'
          break
        case 'hour':
          salaryPeriod = 'hourly'
          break
        case 'day':
          salaryPeriod = 'daily'
          break
        default:
          salaryPeriod = 'monthly'
      }
    }
    
    // Convert to SGD monthly
    const minConverted = this.convertToSGDMonthly({
      amount: minAmount,
      currency,
      period: salaryPeriod
    })
    
    const maxConverted = this.convertToSGDMonthly({
      amount: maxAmount,
      currency,
      period: salaryPeriod
    })
    
    return {
      min: minConverted.amount,
      max: maxConverted.amount,
      currency: 'SGD'
    }
  }
  
  /**
   * Format salary for display
   */
  static formatSalary(amount: number, currency: string = 'SGD', period: 'monthly' | 'yearly' = 'monthly'): string {
    const formattedAmount = new Intl.NumberFormat('en-SG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount)
    
    const currencySymbol = currency === 'SGD' ? 'S$' : 
                          currency === 'USD' ? '$' :
                          currency === 'EUR' ? '€' :
                          currency === 'GBP' ? '£' :
                          currency === 'JPY' ? '¥' :
                          currency === 'INR' ? '₹' : currency
    
    const periodText = period === 'yearly' ? '/year' : '/month'
    
    return `${currencySymbol}${formattedAmount}${periodText}`
  }
  
  /**
   * Get current exchange rates (for reference)
   */
  static getExchangeRates(): Record<string, number> {
    return { ...EXCHANGE_RATES }
  }
  
  /**
   * Update exchange rates (should be called periodically)
   */
  static updateExchangeRates(newRates: Record<string, number>): void {
    Object.assign(EXCHANGE_RATES, newRates)
  }
}

// Export singleton instance
export const currencyConverter = new CurrencyConverter()
