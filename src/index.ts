import ccxt from 'ccxt'
import fs from 'fs'

const config = JSON.parse(fs.readFileSync('config.json').toString())
console.log(config.default)
let kucoin = new ccxt.kucoin(config[config.default])
if (config.default === 'sandbox') kucoin.urls.api = kucoin.urls.test
kucoin.enableRateLimit = true
kucoin.timeout = 30000
 
const file = fs.createWriteStream('KucoinExport.csv')
file.write('Type,Date,InOrBuyAmount,InOrBuyCurrency,OutOrSellAmount,OutOrSellCurrency,FeeAmount,FeeCurrency\n')

const fetchLedger = async () => {
  const accounts = await kucoin.fetchAccounts()
  const currencies = 
    accounts
      .filter((account: any) => account.type === 'trade')
      .map((account: any) => account.currency)

  const fetchLedgers = async (total: any, currency: string) => {
    const ledger = await kucoin.fetchLedger(currency, undefined, 500)
    return [ ...await total, ...ledger ]
  }

  return await currencies.reduce(fetchLedgers, [])
}

const earliestTransaction = (ledger: any) => {
  const dates = ledger.map((l: any) => l.timestamp)
  return Math.min(...dates)
}

const currencies = (item: any, side: string) => {
  const currencies = item.symbol.split('/')
  return item.side === side ? currencies[0] : currencies[1]
}

const buyCurrency = (item: any) => currencies(item, 'buy')
const sellCurrency = (item: any) => currencies(item, 'sell')
const buyAmount = (item: any) => item.side === 'buy' ? item.amount : item.cost
const sellAmount = (item: any) => item.side === 'sell' ? item.amount : item.cost

const writeTradeLine = (item: any) => {
  console.log(item)

  const datetime = kucoin.iso8601(item.timestamp)
  const line = [
    'Trade',
    datetime,
    buyAmount(item),
    buyCurrency(item),
    sellAmount(item),
    sellCurrency(item),
    item.fee.cost,
    item.fee.currency
  ].join(',') + '\n'

  file.write(line)
}

const writeLedgerLine = (item: any) => {
  console.log(item)

  const line = [
    item.info.bizType,
    item.datetime,
    item.direction === 'in' ? (item.amount - item.fee.cost) : '',
    item.direction === 'in' ? item.currency : '',
    item.direction === 'out' ? (item.amount - item.fee.cost) : '',
    item.direction === 'out' ? item.currency : '',
    item.fee.cost,
    item.fee.code
  ].join(',') + '\n'
    
  file.write(line)
}

const ONE_DAY = 24 * 60 * 60 * 1000 // To ensure timezones don't truncate data
const ONE_WEEK = 7 * ONE_DAY

;(async () => {
  const ledger = await fetchLedger()
  const startTimestamp = earliestTransaction(ledger) - ONE_DAY

  ledger.forEach(writeLedgerLine)

  let timestamp = startTimestamp
  let params = { currentPage: 1 }
  while(timestamp < kucoin.milliseconds()) {
    const trades = await kucoin.fetchMyTrades(undefined, timestamp, 500, params)
    if (trades.length > 0) {
      console.log(`${trades.length} entries for ${kucoin.iso8601(timestamp)}`)
      trades.forEach(writeTradeLine)

      if (trades.length === 500) {
        params = { currentPage: params.currentPage + 1 }
      } else {
        timestamp += ONE_WEEK
        params = { currentPage: 1 }
      }
    } else {
      console.log(`No entries for ${kucoin.iso8601(timestamp)}`)
      timestamp += ONE_WEEK
      params = { currentPage: 1 }
    }
  }

  file.end() 
})()

