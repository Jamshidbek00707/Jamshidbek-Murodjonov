import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  Scissors, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  LayoutDashboard,
  Settings as SettingsIcon,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Service {
  id: string;
  name: string;
  price: number;
}

interface TimeSlot {
  id: string;
  start_time: string;
}

interface Booking {
  id: string;
  client_name: string;
  client_id: string;
  date: string;
  time: string;
  status: 'confirmed' | 'cancelled';
  services: { name: string };
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'bookings' | 'services' | 'slots'>('bookings');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [newService, setNewService] = useState({ name: '', price: '' });
  const [newSlot, setNewSlot] = useState('');

  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, sRes, tRes] = await Promise.all([
        fetch('/api/bookings'),
        fetch('/api/services'),
        fetch('/api/slots')
      ]);
      
      const bData = await bRes.json();
      const sData = await sRes.json();
      const tData = await tRes.json();

      if (bData.code === 'PGRST116' || sData.code === 'PGRST116' || tData.code === 'PGRST116' || bData.error || sData.error || tData.error) {
        setShowSetup(true);
      } else {
        setBookings(Array.isArray(bData) ? bData : []);
        setServices(Array.isArray(sData) ? sData : []);
        setSlots(Array.isArray(tData) ? tData : []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setShowSetup(true);
    } finally {
      setLoading(false);
    }
  };

  const addService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name || !newService.price) return;
    await fetch('/api/services', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newService.name, price: Number(newService.price) })
    });
    setNewService({ name: '', price: '' });
    fetchData();
  };

  const deleteService = async (id: string) => {
    await fetch(`/api/services/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const addSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSlot) return;
    await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_time: newSlot })
    });
    setNewSlot('');
    fetchData();
  };

  const deleteSlot = async (id: string) => {
    await fetch(`/api/slots/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const cancelBooking = async (id: string) => {
    await fetch(`/api/bookings/${id}/cancel`, { method: 'POST' });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-white border-r border-black/5 p-6 flex flex-col">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
            <Scissors className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">BarberBot Pro</h1>
        </div>

        <nav className="space-y-2 flex-1">
          <button 
            onClick={() => setActiveTab('bookings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'bookings' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Bookings</span>
          </button>
          <button 
            onClick={() => setActiveTab('services')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'services' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
          >
            <Scissors size={20} />
            <span className="font-medium">Services</span>
          </button>
          <button 
            onClick={() => setActiveTab('slots')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'slots' ? 'bg-black text-white' : 'hover:bg-black/5'}`}
          >
            <Clock size={20} />
            <span className="font-medium">Time Slots</span>
          </button>
        </nav>

        <div className="pt-6 border-t border-black/5">
          <div className="flex items-center gap-3 px-4 py-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Users size={16} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-black/40">Admin Mode</p>
              <p className="text-sm font-medium">Barber Shop</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="ml-64 p-10">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-black/40 mb-2">Dashboard</p>
            <h2 className="text-4xl font-bold tracking-tight">
              {activeTab === 'bookings' && 'Client Appointments'}
              {activeTab === 'services' && 'Service Menu'}
              {activeTab === 'slots' && 'Schedule Settings'}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-sm text-black/40">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center h-64"
            >
              <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'bookings' && (
                <div className="bg-white rounded-3xl shadow-sm border border-black/5 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-bottom border-black/5 bg-black/2">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/40">Client</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/40">Service</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/40">Date & Time</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/40">Status</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-black/40 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-black/[0.01] transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold">{booking.client_name}</p>
                            <p className="text-xs text-black/40">ID: {booking.client_id}</p>
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 bg-black/5 rounded-full text-sm font-medium">
                              {booking.services?.name}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <Calendar size={14} className="text-black/40" />
                              {booking.date}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-black/40">
                              <Clock size={14} />
                              {booking.time}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {booking.status === 'confirmed' ? (
                              <div className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold uppercase tracking-wider">
                                <CheckCircle2 size={16} />
                                Confirmed
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-red-500 text-sm font-bold uppercase tracking-wider">
                                <XCircle size={16} />
                                Cancelled
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {booking.status === 'confirmed' && (
                              <button 
                                onClick={() => cancelBooking(booking.id)}
                                className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              >
                                <Trash2 size={18} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {bookings.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-20 text-center text-black/40 italic">
                            No bookings found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'services' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-4">
                    {services.map((service) => (
                      <div key={service.id} className="bg-white p-6 rounded-2xl border border-black/5 flex justify-between items-center shadow-sm">
                        <div>
                          <h3 className="text-lg font-bold">{service.name}</h3>
                          <p className="text-2xl font-light text-black/60">${service.price}</p>
                        </div>
                        <button 
                          onClick={() => deleteService(service.id)}
                          className="w-10 h-10 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white p-8 rounded-3xl border border-black/5 h-fit shadow-sm">
                    <h3 className="text-xl font-bold mb-6">Add New Service</h3>
                    <form onSubmit={addService} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-black/40 block mb-2">Service Name</label>
                        <input 
                          type="text" 
                          value={newService.name}
                          onChange={(e) => setNewService({ ...newService, name: e.target.value })}
                          className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-black outline-none transition-all"
                          placeholder="e.g. Haircut"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-black/40 block mb-2">Price ($)</label>
                        <input 
                          type="number" 
                          value={newService.price}
                          onChange={(e) => setNewService({ ...newService, price: e.target.value })}
                          className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-black outline-none transition-all"
                          placeholder="e.g. 25"
                        />
                      </div>
                      <button className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black/90 transition-all">
                        <Plus size={20} />
                        Add Service
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'slots' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {slots.map((slot) => (
                        <div key={slot.id} className="group relative bg-[#F5F5F0] p-4 rounded-2xl flex items-center justify-center font-mono font-bold text-lg">
                          {slot.start_time}
                          <button 
                            onClick={() => deleteSlot(slot.id)}
                            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-3xl border border-black/5 h-fit shadow-sm">
                    <h3 className="text-xl font-bold mb-6">Add Time Slot</h3>
                    <form onSubmit={addSlot} className="space-y-4">
                      <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-black/40 block mb-2">Start Time</label>
                        <input 
                          type="time" 
                          value={newSlot}
                          onChange={(e) => setNewSlot(e.target.value)}
                          className="w-full px-4 py-3 bg-[#F5F5F0] rounded-xl border-none focus:ring-2 focus:ring-black outline-none transition-all"
                        />
                      </div>
                      <button className="w-full bg-black text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black/90 transition-all">
                        <Plus size={20} />
                        Add Slot
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Setup Modal */}
      <AnimatePresence>
        {showSetup && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[2rem] p-10 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                  <SettingsIcon className="text-amber-600" />
                </div>
                <h2 className="text-3xl font-bold">Database Setup Required</h2>
              </div>
              <p className="text-black/60 mb-8 leading-relaxed">
                It looks like your Supabase tables haven't been created yet. Please run the following SQL in your Supabase SQL Editor to initialize the database:
              </p>
              <div className="relative group">
                <div className="bg-[#F5F5F0] p-6 rounded-2xl font-mono text-xs overflow-x-auto mb-8 max-h-64 border border-black/5">
                  <pre id="sql-code">{`CREATE TABLE services (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE time_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  start_time TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_id TEXT NOT NULL,
  service_id UUID REFERENCES services(id),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Initial Data
INSERT INTO services (name, price) VALUES 
('Haircut', 25.00),
('Beard Trim', 15.00),
('Hair + Beard Combo', 35.00),
('Hair Styling', 20.00);

INSERT INTO time_slots (start_time) VALUES 
('10:00'), ('11:00'), ('12:00'), ('13:00'), ('14:00'), ('15:00'), ('16:00'), ('17:00');`}</pre>
                </div>
                <button 
                  onClick={() => {
                    const code = document.getElementById('sql-code')?.innerText;
                    if (code) navigator.clipboard.writeText(code);
                  }}
                  className="absolute top-4 right-4 bg-white/80 backdrop-blur shadow-sm border border-black/5 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-white transition-all"
                >
                  Copy SQL
                </button>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowSetup(false)}
                  className="flex-1 bg-black text-white py-4 rounded-xl font-bold hover:bg-black/90 transition-all"
                >
                  I've run the SQL
                </button>
                <button 
                  onClick={() => window.location.reload()}
                  className="px-8 bg-black/5 text-black py-4 rounded-xl font-bold hover:bg-black/10 transition-all"
                >
                  Refresh
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
