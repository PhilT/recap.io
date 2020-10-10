import Ccxt from 'ccxt'
import Kucoin from 'kucoin-sdk'
import fs from 'fs'
import { KucoinSDK } from 'kucoin-sdk/types'

const config = fs.read
new Ccxt.kucoin({ apiKey, secret, password })
 
const header = 'Type,Date,InOrBuyCurrency,OutOrSellCurrency,InOrBuyAmount,OutOrSellAmount,FeeAmount,FeeCurrency'
const file = fs.createWriteStream('KucoinExport.csv')
file.write(header + '\n')

let KucoinInstance = new Kucoin()

/*
let KucoinInstance = new Kucoin()
*/
const daysAgo = new Date().setDate(new Date().getDate() - 7)
// change this to a loop until account opened date (need to find out how to get account opening date)

const response = KucoinInstance.listFills(
  { tradeType: 'TRADE' }, //endAt: daysAgo.toString() }
)

const currencies = (item: any, side: string) => {
  const currencies = item.symbol.split('-')
  return item.side === side ? currencies[0] : currencies[1]
}

const buyCurrency = (item: any) => currencies(item, 'buy')
const sellCurrency = (item: any) => currencies(item, 'sell')
const buyAmount = (item: any) => item.side === 'buy' ? item.funds : 0
const sellAmount = (item: any) => item.side === 'sell' ? item.funds : 0

const writeLine = (item: any) => {
  const line = [
    'TRADE',
    new Date(item.createdAt).toISOString(),
    buyCurrency(item),
    sellCurrency(item),
    buyAmount(item),
    sellAmount(item),
    item.fee,
    item.feeCurrency
  ].join(',') + '\n'
  file.write(line)
}

const handleResponse = (response: KucoinSDK.Http.Data<any>) => {
  response.data.items.forEach(writeLine)
}

response.then(handleResponse)
  .catch( err => console.log("Error:", err) )
  .finally( () => file.end() )

