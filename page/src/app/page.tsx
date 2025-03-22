import { ConnectWallet } from './components/ConnectWallet';
import { OrderBook } from './components/OrderBook';
import { OrderForm } from './components/OrderForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <header className="w-full bg-gray-900 border-b border-gray-800 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600">
              <span className="text-white font-bold">DX</span>
            </div>
            <h1 className="text-xl font-bold text-gray-100">DexTrustEE</h1>
          </div>
          <ConnectWallet />
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <OrderBook />
          </div>
          <div>
            <OrderForm />
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 border-t border-gray-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-400">
            &copy; {new Date().getFullYear()} DexTrustEE. All rights reserved.
            <br />
            <span className="text-xs text-gray-500">
              Transactions are processed in a private TEE environment for enhanced security and privacy.
            </span>
          </p>
        </div>
      </footer>
    </div>
  );
}
