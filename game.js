const crops = {
  wheat: { name: 'Пшеница', icon: '🌾', time: 18, cost: 2, price: 4 },
  carrot: { name: 'Морковь', icon: '🥕', time: 24, cost: 3, price: 6 },
  clover: { name: 'Клевер', icon: '🍀', time: 30, cost: 4, price: 7 },
};
const goods = {
  ...crops,
  egg: { name: 'Яйцо', icon: '🥚', price: 9 },
  milk: { name: 'Молоко', icon: '🥛', price: 15 },
};
const animals = {
  hen: { name: 'Курица', icon: '🐔', feed: 'wheat', food: 'пшеницей', product: 'egg', time: 20 },
  cow: { name: 'Корова', icon: '🐄', feed: 'clover', food: 'клевером', product: 'milk', time: 30, cost: 60 },
};
const orders = [
  { name: 'Морковь для супа', need: { carrot: 2 }, reward: 20 },
  { name: 'Завтрак у соседей', need: { egg: 1, wheat: 1 }, reward: 26 },
  { name: 'Обед с фермы', need: { milk: 1, carrot: 1 }, reward: 38 },
];
const bedCosts = [0, 0, 0, 0, 28, 42];
const key = 'warm-farm:v1:' + new URL('./', location.href).pathname;
const byId = id => document.getElementById(id);
const initial = () => ({
  coins: 18,
  seeds: { wheat: 3, carrot: 3, clover: 1 },
  stock: { wheat: 0, carrot: 0, clover: 0, egg: 0, milk: 0 },
  beds: bedCosts.map(cost => ({ open: !cost, crop: null })),
  animals: { hen: { open: true, readyAt: 0 }, cow: { open: false, readyAt: 0 } },
  completed: [],
});

function load() {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : initial();
  } catch {
    return initial();
  }
}

let state = load();
let selected = 'wheat';
let noticeTimer;
const button = (label, action, id, disabled = false, extra = '') =>
  `<button type="button" data-action="${action}" data-id="${id}" ${disabled ? 'disabled' : ''} ${extra}>${label}</button>`;
const timer = readyAt => `<span class="timer" data-ready="${readyAt}"></span>`;

function refresh(id, markup) {
  const container = byId(id);
  const active = document.activeElement;
  const restore = container.contains(active) && active.dataset.action;
  container.innerHTML = markup;
  if (restore) {
    const replacement = [...container.querySelectorAll('button')].find(item =>
      item.dataset.action === active.dataset.action && item.dataset.id === active.dataset.id);
    replacement?.focus({ preventScroll: true });
  }
}

function render() {
  const now = Date.now();
  byId('coins').textContent = state.coins;
  byId('open-beds').textContent = `${state.beds.filter(bed => bed.open).length} из 6 открыто`;
  refresh('seeds', Object.entries(crops).map(([id, crop]) =>
    button(`<span>${crop.icon} ${crop.name}</span><b>${state.seeds[id]}</b>`, 'select', id, false,
      `aria-pressed="${selected === id}"`)).join(''));

  refresh('beds', state.beds.map((bed, i) => {
    let art = '', status, control, kind = 'empty';
    if (!bed.open) {
      kind = 'locked'; art = '🔒'; status = 'Закрыта';
      control = button(`Открыть · ${bedCosts[i]} ●`, 'unlockBed', i, state.coins < bedCosts[i]);
    } else if (!bed.crop) {
      status = 'Свободна';
      control = button('Посадить', 'plant', i, state.seeds[selected] === 0,
        `aria-label="Посадить: ${crops[selected].name}, грядка ${i + 1}"`);
    } else {
      const ready = bed.readyAt <= now;
      kind = ready ? 'ripe' : 'growing';
      art = ready ? crops[bed.crop].icon : '🌱';
      status = ready ? `${crops[bed.crop].name} · готово` : `${crops[bed.crop].name} · ${timer(bed.readyAt)}`;
      control = ready ? button('Собрать', 'harvest', i)
        : button(bed.watered ? 'Полито' : '💧 Полить', 'water', i, bed.watered);
    }
    return `<article class="bed ${kind}"><div class="soil"><span class="bed-number">${i + 1}</span><span class="sprout" aria-hidden="true">${art}</span></div><div class="bed-body"><div>${status}</div>${control}</div></article>`;
  }).join(''));

  refresh('animals', Object.entries(animals).map(([id, animal]) => {
    const pen = state.animals[id];
    let status, control;
    if (!pen.open) {
      status = 'Коровник закрыт';
      control = button(`Открыть · ${animal.cost} ●`, 'unlockCow', id, state.coins < animal.cost);
    } else if (pen.readyAt > now) {
      status = `Сытость 🟢 · ${timer(pen.readyAt)}`;
      control = button('Ждём', 'collect', id, true);
    } else if (pen.readyAt) {
      status = `${goods[animal.product].name} · готово`;
      control = button(`Забрать ${goods[animal.product].icon}`, 'collect', id);
    } else {
      status = `Корм · ${goods[animal.feed].icon} ${state.stock[animal.feed]}`;
      control = button(`Кормить ${animal.food}`, 'feed', id, state.stock[animal.feed] === 0);
    }
    return `<article class="animal ${id}"><span class="animal-icon" aria-hidden="true">${animal.icon}</span><div class="animal-info"><h3>${animal.name}</h3><div>${status}</div>${control}</div></article>`;
  }).join(''));

  refresh('storage', Object.entries(goods).map(([id, item]) => `<div class="row"><span>${item.icon} ${item.name} <b>×${state.stock[id]}</b></span>${
    button(`${item.price} ●`, 'sell', id, !state.stock[id], `aria-label="Продать: ${item.name} за ${item.price} монет"`)
  }</div>`).join(''));

  byId('order-count').textContent = `${state.completed.length}/${orders.length}`;
  refresh('orders', orders.map(({ name, need, reward }, i) => {
    const done = state.completed.includes(i);
    const locked = i !== state.completed.length;
    const enough = Object.entries(need).every(([id, count]) => state.stock[id] >= count);
    const items = Object.entries(need).map(([id, count]) => `${goods[id].icon} ${goods[id].name} ×${count}`).join(' · ');
    return `<article class="order"><h3>${name}</h3><p>${items}</p>${done
      ? '<span class="done">✓ Выполнен</span>'
      : button(locked ? 'После предыдущего заказа' : `Сдать · +${reward} ●`, 'order', i, locked || !enough)}</article>`;
  }).join(''));

  refresh('shop', Object.entries(crops).map(([id, crop]) =>
    `<div class="row"><span>${crop.icon} ${crop.name}</span>${button(`Купить · ${crop.cost} ●`, 'buy', id, state.coins < crop.cost)}</div>`
  ).join('') + '<p class="hint">Если запасы иссякли, возьмите семя пшеницы бесплатно.</p>' +
    button('Взять семя', 'rescue', 'wheat', !canRescue(state)));
  tick();
}

function canRescue(save) {
  return save.coins < crops.wheat.cost && !Object.values(save.seeds).some(Boolean) &&
    !Object.values(save.stock).some(Boolean) && !save.beds.some(bed => bed.crop) &&
    !Object.values(save.animals).some(pen => pen.readyAt);
}

function tick() {
  const now = Date.now();
  for (const element of document.querySelectorAll('[data-ready]')) {
    const seconds = Math.ceil((Number(element.dataset.ready) - now) / 1000);
    if (seconds <= 0) {
      render();
      return;
    }
    element.textContent = `0:${String(seconds).padStart(2, '0')}`;
  }
}

function transact(action, id) {
  // Read the latest snapshot before applying an action from an older tab.
  const save = load();
  const now = Date.now();
  const bed = save.beds[id];
  const pen = save.animals[id];
  const animal = animals[id];
  switch (action) {
    case 'buy':
      if (!crops[id] || save.coins < crops[id].cost) return;
      save.coins -= crops[id].cost;
      save.seeds[id]++;
      selected = id;
      break;
    case 'rescue':
      if (!canRescue(save)) return;
      save.seeds.wheat++;
      selected = 'wheat';
      break;
    case 'plant':
      if (!bed?.open || bed.crop || !save.seeds[selected]) return;
      save.seeds[selected]--;
      Object.assign(bed, { crop: selected, readyAt: now + crops[selected].time * 1000, watered: false });
      break;
    case 'water':
      if (!bed?.crop || bed.watered || bed.readyAt <= now) return;
      bed.readyAt = now + Math.round((bed.readyAt - now) * 0.75);
      bed.watered = true;
      break;
    case 'harvest':
      if (!bed?.crop || bed.readyAt > now) return;
      save.stock[bed.crop]++;
      save.beds[id] = { open: true, crop: null };
      break;
    case 'unlockBed':
      if (!bed || bed.open || save.coins < bedCosts[id]) return;
      save.coins -= bedCosts[id];
      bed.open = true;
      break;
    case 'unlockCow':
      if (save.animals.cow.open || save.coins < animals.cow.cost) return;
      save.coins -= animals.cow.cost;
      save.animals.cow.open = true;
      break;
    case 'feed':
      if (!pen?.open || pen.readyAt || !save.stock[animal.feed]) return;
      save.stock[animal.feed]--;
      pen.readyAt = now + animal.time * 1000;
      break;
    case 'collect':
      if (!pen?.open || !pen.readyAt || pen.readyAt > now) return;
      save.stock[animal.product]++;
      pen.readyAt = 0;
      break;
    case 'sell':
      if (!save.stock[id]) return;
      save.stock[id]--;
      save.coins += goods[id].price;
      break;
    case 'order': {
      const order = orders[id];
      if (!order || Number(id) !== save.completed.length) return;
      const items = Object.entries(order.need);
      if (items.some(([item, count]) => save.stock[item] < count)) return;
      for (const [item, count] of items) save.stock[item] -= count;
      save.coins += order.reward;
      save.completed.push(Number(id));
      break;
    }
    default:
      return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(save));
    state = save;
  } catch {
    byId('save-note').textContent = 'Хранилище недоступно. Действие не сохранено.';
    return;
  }
  const messages = {
    buy: 'Семя куплено', rescue: 'Семя пшеницы получено', harvest: 'Урожай на складе',
    unlockBed: 'Грядка открыта', unlockCow: 'Коровник открыт', collect: 'Продукт на складе',
    sell: 'Товар продан', order: 'Заказ выполнен',
  };
  if (messages[action]) {
    byId('notice').textContent = messages[action];
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { byId('notice').textContent = ''; }, 2200);
  }
}

document.addEventListener('click', event => {
  const item = event.target.closest('button[data-action]');
  if (!item || item.disabled) return;
  const { action, id } = item.dataset;
  if (action === 'select') selected = id;
  else transact(action, id);
  render();
});
window.addEventListener('storage', event => {
  if (event.key === key || event.key === null) {
    state = load();
    render();
  }
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) render();
});
render();
setInterval(tick, 250);

if ('serviceWorker' in navigator) {
  const checkOffline = () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return;
    const channel = new MessageChannel();
    channel.port1.onmessage = event => {
      byId('offline').hidden = event.data !== true;
      channel.port1.close();
    };
    worker.postMessage('check-cache', [channel.port2]);
  };
  navigator.serviceWorker.addEventListener('controllerchange', checkOffline);
  navigator.serviceWorker.register('./sw.js').then(checkOffline).catch(console.warn);
}
