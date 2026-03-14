-- --- Database Schema (Run this in Supabase SQL Editor) ---
/*
CREATE TABLE services (
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
('10:00'), ('11:00'), ('12:00'), ('13:00'), ('14:00'), ('15:00'), ('16:00'), ('17:00');
*/

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import TelegramBot from 'node-telegram-bot-api';
import { supabase } from './src/lib/supabase.js';
import cors from 'cors';
import { format, addDays, startOfToday, parseISO } from 'date-fns';

// --- Configuration ---
const token = process.env.TELEGRAM_BOT_TOKEN;
const adminId = process.env.ADMIN_TELEGRAM_ID;
const PORT = 3000;

// --- Bot Initialization ---
let bot: TelegramBot | null = null;
if (token) {
  bot = new TelegramBot(token, { polling: true });
  console.log('Telegram bot started');
} else {
  console.warn('TELEGRAM_BOT_TOKEN not found. Bot functionality will be disabled.');
}

// --- Bot Logic ---
const userStates: Record<number, { step: string; serviceId?: string; date?: string; time?: string }> = {};

if (bot) {
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    userStates[chatId] = { step: 'selecting_service' };

    const { data: services, error } = await supabase.from('services').select('*');
    
    if (error || !services || services.length === 0) {
      bot?.sendMessage(chatId, "Welcome! We're currently setting up our services. Please check back later.");
      return;
    }

    const keyboard = services.map(s => ([{
      text: `${s.name} - $${s.price}`,
      callback_data: `service_${s.id}`
    }]));

    bot?.sendMessage(chatId, "Welcome to our Barbershop! ✂️\nPlease select a service:", {
      reply_markup: { inline_keyboard: keyboard }
    });
  });

  bot.on('callback_query', async (query) => {
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    const data = query.data || '';
    const state = userStates[chatId];

    if (data.startsWith('service_')) {
      const serviceId = data.split('_')[1];
      userStates[chatId] = { ...state, step: 'selecting_date', serviceId };

      // Show next 7 days
      const today = startOfToday();
      const keyboard = [];
      for (let i = 0; i < 7; i++) {
        const date = addDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        keyboard.push([{
          text: format(date, 'EEEE, MMM d'),
          callback_data: `date_${dateStr}`
        }]);
      }

      bot?.editMessageText("Great! Now choose a date:", {
        chat_id: chatId,
        message_id: query.message?.message_id,
        reply_markup: { inline_keyboard: keyboard }
      });
    } 
    
    else if (data.startsWith('date_')) {
      const date = data.split('_')[1];
      userStates[chatId] = { ...state, step: 'selecting_time', date };

      // Fetch booked slots for this date
      const { data: bookings } = await supabase
        .from('bookings')
        .select('time')
        .eq('date', date)
        .eq('status', 'confirmed');

      const bookedTimes = bookings?.map(b => b.time) || [];

      // Fetch all available time slots
      const { data: slots } = await supabase.from('time_slots').select('start_time').order('start_time');
      
      if (!slots || slots.length === 0) {
        bot?.sendMessage(chatId, "No time slots available for this day.");
        return;
      }

      const availableSlots = slots.filter(s => !bookedTimes.includes(s.start_time));

      const keyboard = [];
      for (let i = 0; i < availableSlots.length; i += 2) {
        const row = [];
        row.push({ text: availableSlots[i].start_time, callback_data: `time_${availableSlots[i].start_time}` });
        if (availableSlots[i+1]) {
          row.push({ text: availableSlots[i+1].start_time, callback_data: `time_${availableSlots[i+1].start_time}` });
        }
        keyboard.push(row);
      }

      bot?.editMessageText(`Available times for ${format(parseISO(date), 'MMM d')}:`, {
        chat_id: chatId,
        message_id: query.message?.message_id,
        reply_markup: { inline_keyboard: keyboard }
      });
    }

    else if (data.startsWith('time_')) {
      const time = data.split('_')[1];
      const { serviceId, date } = state;

      if (!serviceId || !date) return;

      // Double check availability (prevent race condition)
      const { data: existing } = await supabase
        .from('bookings')
        .select('id')
        .eq('date', date)
        .eq('time', time)
        .eq('status', 'confirmed')
        .single();

      if (existing) {
        bot?.sendMessage(chatId, "Sorry, this slot was just taken! Please choose another time.");
        return;
      }

      // Create booking
      const { data: service } = await supabase.from('services').select('name').eq('id', serviceId).single();
      const clientName = query.from.first_name + (query.from.last_name ? ` ${query.from.last_name}` : '');

      const { error: bookingError } = await supabase.from('bookings').insert({
        client_name: clientName,
        client_id: query.from.id.toString(),
        service_id: serviceId,
        date,
        time,
        status: 'confirmed'
      });

      if (bookingError) {
        bot?.sendMessage(chatId, "An error occurred while booking. Please try again.");
        return;
      }

      bot?.editMessageText(`✅ Booking Confirmed!\n\nService: ${service?.name}\nDate: ${format(parseISO(date), 'EEEE, MMM d')}\nTime: ${time}\n\nSee you soon!`, {
        chat_id: chatId,
        message_id: query.message?.message_id
      });

      // Notify Admin
      if (adminId) {
        bot?.sendMessage(adminId, `🔔 New Appointment!\n\nClient: ${clientName}\nService: ${service?.name}\nDate: ${date}\nTime: ${time}`);
      }

      delete userStates[chatId];
    }
  });
}

// --- Server Setup ---
async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/bookings', async (req, res) => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*, services(name)')
      .order('date', { ascending: true })
      .order('time', { ascending: true });
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.get('/api/services', async (req, res) => {
    const { data, error } = await supabase.from('services').select('*');
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post('/api/services', async (req, res) => {
    const { data, error } = await supabase.from('services').insert(req.body).select();
    if (error) return res.status(500).json(error);
    res.json(data[0]);
  });

  app.delete('/api/services/:id', async (req, res) => {
    const { error } = await supabase.from('services').delete().eq('id', req.params.id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  app.get('/api/slots', async (req, res) => {
    const { data, error } = await supabase.from('time_slots').select('*').order('start_time');
    if (error) return res.status(500).json(error);
    res.json(data);
  });

  app.post('/api/slots', async (req, res) => {
    const { data, error } = await supabase.from('time_slots').insert(req.body).select();
    if (error) return res.status(500).json(error);
    res.json(data[0]);
  });

  app.delete('/api/slots/:id', async (req, res) => {
    const { error } = await supabase.from('time_slots').delete().eq('id', req.params.id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  app.post('/api/bookings/:id/cancel', async (req, res) => {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', req.params.id);
    if (error) return res.status(500).json(error);
    res.json({ success: true });
  });

  // Vite middleware
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
