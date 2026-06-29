/** Default seed data. Mirrors Python `app/seed.py` constants + FareConfig defaults. */

// Defaults from Python `models.py` FareConfig.
export const DEFAULT_FARE_CONFIG: Record<string, any> = {
  base_fare: 30.0,
  per_km: 12.0,
  poochari_fare: 250.0,
  radhakund_fare: 150.0,
  combined_fare: 350.0,
  commission_pct: 10.0,
  cancellation_fee: 20.0,
  landmarks: [],
  city_center: { lat: 27.4985, lng: 77.4615 },
  boundary_radius_km: 15.0,
  dispatch_radius_km: 5.0,
  surge_pct: 0.0,
  support_phone: null,
};

export const SAMPLE_STAYS: Record<string, any>[] = [
  {
    id: 'stay-shri-giriraj-dharamshala',
    name: 'Shri Giriraj Dharamshala',
    type: 'dharamshala',
    description:
      'Trust-run dharamshala steps from Daan Ghati Mandir. Clean rooms, ' +
      'bhojanalaya on premises, ideal for family groups doing parikrama.',
    address: 'Daan Ghati Road, near Mukharvind Mandir, Govardhan',
    area: 'Daan Ghati',
    lat: 27.4958,
    lng: 77.4699,
    contact_phone: '9690000001',
    whatsapp: '9690000001',
    price_min: 400,
    price_max: 1200,
    donation_based: false,
    room_types: ['Single', 'Double', 'Family'],
    capacity: 60,
    amenities: [
      'parking',
      'food',
      'hot_water',
      'family_rooms',
      'elderly_friendly',
      'power_backup',
    ],
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Guest_house_building_of_Kapurthala_01.jpg/1280px-Guest_house_building_of_Kapurthala_01.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Hotel_room_interior_at_hotel_Radisson_Blu_Oulu.jpg/1280px-Hotel_room_interior_at_hotel_Radisson_Blu_Oulu.jpg',
    ],
    verified: true,
    available: true,
    featured: true,
  },
  {
    id: 'stay-radha-kund-ashram',
    name: 'Radha Kund Seva Ashram',
    type: 'ashram',
    description:
      'Peaceful ashram beside Radha Kund. Donation-based stay for pilgrims, ' +
      'sattvic prasad served morning and evening.',
    address: 'Radha Kund Parikrama Marg, Govardhan',
    area: 'Radha Kund',
    lat: 27.5472,
    lng: 77.4525,
    contact_phone: '9690000002',
    whatsapp: '9690000002',
    price_min: null,
    price_max: null,
    donation_based: true,
    room_types: ['Dormitory', 'Single'],
    capacity: 40,
    amenities: ['food', 'hot_water', 'locker'],
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Radha_Keli_Kunj_Ashram_DSC04434.jpg/1280px-Radha_Keli_Kunj_Ashram_DSC04434.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Temple_in_Radha-Kund_7%2C_Mars_2007.jpg/1280px-Temple_in_Radha-Kund_7%2C_Mars_2007.jpg',
    ],
    verified: true,
    available: true,
    featured: false,
  },
  {
    id: 'stay-jatipura-guest-house',
    name: 'Jatipura Yatri Guest House',
    type: 'guesthouse',
    description:
      'Budget guest house near Jatipura Mukharvind, walking distance to the ' +
      'parikrama start point. Good for first-time and outside-state pilgrims.',
    address: 'Jatipura Main Road, opp. Bus Stand, Govardhan',
    area: 'Jatipura',
    lat: 27.4988,
    lng: 77.4535,
    contact_phone: '9690000003',
    whatsapp: '9690000003',
    price_min: 600,
    price_max: 1800,
    donation_based: false,
    room_types: ['Double', 'Family', 'Deluxe AC'],
    capacity: 30,
    amenities: [
      'parking',
      'ac',
      'hot_water',
      'wifi',
      'family_rooms',
      'power_backup',
      'lift',
    ],
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Entrance_Guest_House_IITGN_Gujarat_Sep25_A7CR_07905.jpg/1280px-Entrance_Guest_House_IITGN_Gujarat_Sep25_A7CR_07905.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b7/Hotel_room_interior_at_hotel_Radisson_Blu_Oulu.jpg/1280px-Hotel_room_interior_at_hotel_Radisson_Blu_Oulu.jpg',
    ],
    verified: true,
    available: true,
    featured: true,
  },
  {
    id: 'stay-kusum-sarovar-lodge',
    name: 'Kusum Sarovar Pilgrim Lodge',
    type: 'lodge',
    description:
      'Simple, clean lodge on the Kusum Sarovar route. Senior-citizen friendly ' +
      'with ground-floor rooms and assisted check-in.',
    address: 'Kusum Sarovar Road, Govardhan',
    area: 'Kusum Sarovar',
    lat: 27.529,
    lng: 77.4482,
    contact_phone: '9690000004',
    whatsapp: '9690000004',
    price_min: 500,
    price_max: 1000,
    donation_based: false,
    room_types: ['Single', 'Double'],
    capacity: 24,
    amenities: ['parking', 'hot_water', 'elderly_friendly', 'wheelchair'],
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Kusum_Sarovar_-Mathura_-Uttar_Pradesh_-PXL_20210217_100743045.jpg/1280px-Kusum_Sarovar_-Mathura_-Uttar_Pradesh_-PXL_20210217_100743045.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/8/84/Premier-hotel-bedroom_Huehuetenango_Guatemala.jpg',
    ],
    verified: true,
    available: true,
    featured: false,
  },
];

export const SAMPLE_TEMPLES: Record<string, any>[] = [
  {
    id: 'temple-mukharvind-jatipura',
    name: 'Mukharvind Mandir, Jatipura',
    deity: 'Shri Giriraj Ji (Mukharvind)',
    description:
      'The mukharvind (mouth) of Giriraj Ji at Jatipura — the main ' +
      'starting point of the Govardhan parikrama. Milk abhishek and ' +
      'darshan through the day.',
    address: 'Jatipura, Govardhan, Mathura',
    area: 'Jatipura',
    lat: 27.4985,
    lng: 77.4615,
    contact_phone: null,
    darshan_slots: [
      { label: 'Morning Darshan', open: '05:00', close: '12:00' },
      { label: 'Evening Darshan', open: '16:00', close: '21:30' },
    ],
    aarti_timings: [
      { name: 'Mangala Aarti', time: '05:15' },
      { name: 'Rajbhog Aarti', time: '11:30' },
      { name: 'Sandhya Aarti', time: '19:00' },
    ],
    crowd_level: 'moderate',
    entry_info: 'Free entry. Milk/abhishek samagri available outside.',
    special_note: null,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Govardhan_hill.JPG/1280px-Govardhan_hill.JPG',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Shri_Govardhan_Dham_-_panoramio.jpg/1280px-Shri_Govardhan_Dham_-_panoramio.jpg',
    ],
    verified: true,
    featured: true,
  },
  {
    id: 'temple-daan-ghati',
    name: 'Daan Ghati Mandir',
    deity: 'Shri Giriraj Ji',
    description:
      'Famous Giriraj temple on the parikrama marg where pilgrims offer ' +
      'daan. Very busy on Ekadashi, Purnima and Guru Purnima.',
    address: 'Daan Ghati, Govardhan, Mathura',
    area: 'Daan Ghati',
    lat: 27.4961,
    lng: 77.4694,
    contact_phone: null,
    darshan_slots: [
      { label: 'Morning Darshan', open: '05:00', close: '12:30' },
      { label: 'Evening Darshan', open: '15:30', close: '22:00' },
    ],
    aarti_timings: [
      { name: 'Mangala Aarti', time: '05:30' },
      { name: 'Sandhya Aarti', time: '19:30' },
    ],
    crowd_level: 'high',
    entry_info: 'Free entry.',
    special_note: 'Heavy crowd on Ekadashi & Purnima — arrive early.',
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Daan_Ghati_Temple_in_Govardhan_2014-10-03.jpg/1280px-Daan_Ghati_Temple_in_Govardhan_2014-10-03.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Daan_Ghati_Temple_Goverdhan_-_panoramio.jpg/1280px-Daan_Ghati_Temple_Goverdhan_-_panoramio.jpg',
    ],
    verified: true,
    featured: true,
  },
  {
    id: 'temple-radha-kund',
    name: 'Radha Kund & Shyam Kund',
    deity: 'Shri Radha Rani',
    description:
      'The most sacred kunds of Braj. Snan (holy dip) is especially ' +
      'auspicious on Ahoi Ashtami midnight.',
    address: 'Radha Kund, Govardhan, Mathura',
    area: 'Radha Kund',
    lat: 27.547,
    lng: 77.452,
    contact_phone: null,
    darshan_slots: [{ label: 'Open all day', open: '04:00', close: '22:00' }],
    aarti_timings: [
      { name: 'Morning Aarti', time: '06:00' },
      { name: 'Sandhya Aarti', time: '18:30' },
    ],
    crowd_level: 'low',
    entry_info: 'Free. Snan ghats open through the day.',
    special_note: null,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/94/Radha_Kund.jpg/1280px-Radha_Kund.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Shyam_Kund.jpg/1280px-Shyam_Kund.jpg',
    ],
    verified: true,
    featured: false,
  },
  {
    id: 'temple-kusum-sarovar',
    name: 'Kusum Sarovar',
    deity: 'Radha-Krishna Leela Sthali',
    description:
      'Historic sandstone sarovar and memorial. Peaceful spot on the ' +
      'Govardhan–Radha Kund route, beautiful at sunset.',
    address: 'Kusum Sarovar Road, Govardhan, Mathura',
    area: 'Kusum Sarovar',
    lat: 27.5288,
    lng: 77.4478,
    contact_phone: null,
    darshan_slots: [{ label: 'Open', open: '06:00', close: '19:00' }],
    aarti_timings: [{ name: 'Sandhya Deepdaan', time: '18:45' }],
    crowd_level: 'low',
    entry_info: 'Free entry.',
    special_note: null,
    photos: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/Kusum_Sarovar_Mathura_DSC_2124.jpg/1280px-Kusum_Sarovar_Mathura_DSC_2124.jpg',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Inside_of_kusum_Sarovar_Chhatris.jpg/1280px-Inside_of_kusum_Sarovar_Chhatris.jpg',
    ],
    verified: true,
    featured: false,
  },
];

export const GOVARDHAN_LANDMARKS: Record<string, any>[] = [
  { id: 'mukharvind', name: 'Mukharvind Mandir, Jatipura', lat: 27.4985, lng: 77.4615 },
  { id: 'danghati', name: 'Daan Ghati Mandir', lat: 27.4961, lng: 77.4694 },
  { id: 'radhakund', name: 'Radha Kund', lat: 27.547, lng: 77.452 },
  { id: 'kusumsarovar', name: 'Kusum Sarovar', lat: 27.5288, lng: 77.4478 },
  { id: 'anyor', name: 'Anyor Village', lat: 27.479, lng: 77.4523 },
  { id: 'poochari', name: 'Poochari ka Lota', lat: 27.4756, lng: 77.4445 },
  { id: 'manasi-ganga', name: 'Manasi Ganga', lat: 27.4983, lng: 77.468 },
  { id: 'govind-kund', name: 'Govind Kund', lat: 27.487, lng: 77.4612 },
  { id: 'jatipura', name: 'Jatipura Bus Stand', lat: 27.499, lng: 77.453 },
  { id: 'govardhan-chauraha', name: 'Govardhan Chauraha', lat: 27.4977, lng: 77.4625 },
];
