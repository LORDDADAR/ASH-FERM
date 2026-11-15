const crops = {
  wheat: { name: 'Пшеница', time: 16, cost: 2, price: 4, yield: 1 },
  carrot: { name: 'Морковь', time: 36, cost: 5, price: 7, yield: 2 },
  clover: { name: 'Клевер', time: 24, cost: 3, price: 5, yield: 1 },
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
const market = {
  quick: { label: 'Быстрый заказ', offers: [
    { name: 'Хлеб к завтраку', need: { wheat: 2 }, reward: 16 },
    { name: 'Мука для пекарни', need: { wheat: 3 }, reward: 22 },
    { name: 'Пшеница для мельницы', need: { wheat: 4 }, reward: 29 },
  ] },
  mixed: { label: 'Средний заказ', offers: [
    { name: 'Обед для соседей', need: { wheat: 2, carrot: 2 }, reward: 32 },
    { name: 'Ящик для трактирщика', need: { carrot: 4, clover: 2 }, reward: 56 },
    { name: 'Сбор для ярмарки', need: { wheat: 3, clover: 2 }, reward: 36 },
  ] },
  large: { label: 'Большой заказ', offers: [
    { name: 'Провизия на неделю', need: { wheat: 3, carrot: 4, clover: 2 }, reward: 72 },
    { name: 'Поставка на мельницу', need: { wheat: 6, carrot: 2, clover: 2 }, reward: 74 },
    { name: 'Урожай для трактира', need: { wheat: 2, carrot: 6, clover: 3 }, reward: 98 },
  ] },
  special: { label: 'Особый покупатель', offers: [
    { name: 'Лавка Агаты', need: { carrot: 4, clover: 3, egg: 1 }, reward: 99 },
    { name: 'Ярмарка Агаты', need: { carrot: 4, wheat: 3, clover: 3 }, reward: 108 },
    { name: 'Запасы Агаты', need: { carrot: 6, wheat: 3, clover: 4 }, reward: 138 },
  ] },
};
const specialReputation = 3;
const bedCosts = [0, 0, 0, 0, 36, 58];
const wateringCost = 44;
const initialMarket = () => ({
  positions: { quick: 0, mixed: 0, large: 0, special: 0 },
  active: null,
  reputation: 0,
});
const getOffer = (save, slot) => {
  const offers = market[slot].offers;
  const position = save.market.positions[slot];
  return { ...offers[position % offers.length], id: `${slot}-${position}` };
};
const key = 'warm-farm:v1:' + new URL('./', location.href).pathname;
const byId = id => document.getElementById(id);
const initial = () => ({
  coins: 18,
  seeds: { wheat: 5, carrot: 3, clover: 2 },
  stock: { wheat: 0, carrot: 0, clover: 0, egg: 0, milk: 0 },
  beds: bedCosts.map(cost => ({ open: !cost, crop: null })),
  animals: { hen: { open: true, readyAt: 0 }, cow: { open: false, readyAt: 0 } },
  completed: [],
  market: initialMarket(),
  wateringUpgrade: false,
});

function load() {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return initial();
    const save = JSON.parse(saved);
    save.market ??= { ...initialMarket(), reputation: save.completed?.length ?? 0 };
    save.wateringUpgrade ??= false;
    return save;
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
const art = (id, extra = '') => `<span class="art art-${id} ${extra}" aria-hidden="true"></span>`;
const itemArt = id => crops[id] ? art(id) : goods[id].icon;
const hasItems = (save, need) => Object.entries(need).every(([id, count]) => save.stock[id] >= count);

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
    button(`<span class="seed-name">${art(id)} ${crop.name}</span><b>${state.seeds[id]}</b><small>${crop.time} сек · +${crop.yield} шт.</small>`, 'select', id, false,
      `aria-pressed="${selected === id}"`)).join(''));

  refresh('beds', state.beds.map((bed, i) => {
    let sprite = 'soil', status, control, kind = 'empty';
    if (!bed.open) {
      kind = 'locked';
      sprite = 'locked';
      status = 'Закрыта';
      control = '<a class="plot-link" href="#upgrades-panel">Расширение</a>';
    } else if (!bed.crop) {
      status = 'Свободна';
      control = button('Посадить', 'plant', i, state.seeds[selected] === 0,
        `aria-label="Посадить: ${crops[selected].name}, грядка ${i + 1}"`);
    } else {
      const ready = bed.readyAt <= now;
      kind = ready ? 'ripe' : 'growing';
      sprite = ready ? `ripe-${bed.crop}` : 'sprout';
      status = ready ? `${crops[bed.crop].name} · готово` : `${crops[bed.crop].name} · ${timer(bed.readyAt)}`;
      control = ready ? button('Собрать', 'harvest', i)
        : button(bed.watered ? 'Полито' : `${art('can')} Полить`, 'water', i, bed.watered);
    }
    return `<article class="bed ${kind}"><div class="plot"><span class="bed-number">${i + 1}</span>${art(sprite, 'plot-art')}</div><div class="bed-body"><div>${status}</div>${control}</div></article>`;
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
      status = `Корм · ${itemArt(animal.feed)} ${state.stock[animal.feed]}`;
      control = button(`Кормить ${animal.food}`, 'feed', id, state.stock[animal.feed] === 0);
    }
    return `<article class="animal ${id}"><span class="animal-icon" aria-hidden="true">${animal.icon}</span><div class="animal-info"><h3>${animal.name}</h3><div>${status}</div>${control}</div></article>`;
  }).join(''));

  refresh('storage', Object.entries(goods).map(([id, item]) => `<div class="row"><span>${itemArt(id)} ${item.name} <b>×${state.stock[id]}</b></span>${
    button(`${item.price} ●`, 'sell', id, !state.stock[id], `aria-label="Продать: ${item.name} за ${item.price} монет"`)
  }</div>`).join(''));

  renderMarket();
  const nextBed = state.beds.findIndex(bed => !bed.open);
  refresh('upgrades', `<article class="upgrade">${art('locked', 'upgrade-art')}<div><h3>Расширение поля</h3><p>${nextBed < 0 ? 'Все грядки открыты' : `Откроет грядку №${nextBed + 1}`}</p>${
    nextBed < 0 ? '' : button(`Купить · ${bedCosts[nextBed]} ●`, 'unlockBed', nextBed, state.coins < bedCosts[nextBed])
  }</div></article><article class="upgrade">${art('can', 'upgrade-art')}<div><h3>Улучшенная лейка</h3><p>Полив сокращает оставшееся время на 45% вместо 25%.</p>${
    state.wateringUpgrade ? '<span class="done">Куплено</span>' : button(`Купить · ${wateringCost} ●`, 'upgradeWater', 'can', state.coins < wateringCost)
  }</div></article>`);

  refresh('shop', Object.entries(crops).map(([id, crop]) =>
    `<div class="row"><span>${art(id)} ${crop.name}</span>${button(`Купить · ${crop.cost} ●`, 'buy', id, state.coins < crop.cost)}</div>`
  ).join('') + '<p class="hint">Если запасы иссякли, возьмите семя пшеницы бесплатно.</p>' +
    button('Взять семя', 'rescue', 'wheat', !canRescue(state)));
  tick();
}

function renderMarket() {
  const { reputation, active } = state.market;
  const slots = Object.keys(market).filter(slot => slot !== 'special' || reputation >= specialReputation);
  byId('order-count').textContent = `Репутация · ${reputation}`;
  byId('market-progress').textContent = reputation < specialReputation
    ? `До особого покупателя — заказов: ${specialReputation - reputation}`
    : 'Особый покупатель открыт';
  refresh('orders', slots.map(slot => {
    const { id, name, need, reward } = getOffer(state, slot);
    const accepted = active === slot;
    const items = Object.entries(need).map(([item, count]) =>
      `<li>${itemArt(item)} <span>${goods[item].name}</span><b>${state.stock[item]} / ${count}</b></li>`).join('');
    return `<article class="order ${accepted ? 'accepted' : ''}"><div class="order-meta"><span>${market[slot].label}</span><strong>+${reward} ●</strong></div>
      <h3>${name}</h3><ul aria-label="В амбаре / нужно">${items}</ul>
      <div class="order-actions">${accepted
        ? button('Сдать заказ', 'order', id, !hasItems(state, need)) + button('Отменить', 'cancelOrder', id)
        : button('Взять заказ', 'takeOrder', id, Boolean(active))}</div></article>`;
  }).join(''));

  const tutorial = byId('tutorial');
  tutorial.hidden = reputation > 0;
  if (tutorial.hidden) return;
  if (!active) {
    tutorial.innerHTML = 'Начните с <a href="#market-panel">быстрого заказа на рынке</a>.';
    return;
  }
  const { need } = getOffer(state, active);
  const missing = Object.entries(need).filter(([id, count]) => state.stock[id] < count);
  const ready = missing.some(([id]) => state.beds.some(bed => bed.crop === id && bed.readyAt <= Date.now()));
  const toPlant = missing.filter(([id, count]) => state.stock[id] +
    state.beds.filter(bed => bed.crop === id).reduce((total, bed) => total + (bed.yield ?? 1), 0) < count);
  tutorial.innerHTML = !missing.length ? 'Урожай в амбаре. <a href="#market-panel">Сдайте заказ на рынке</a>.'
    : ready ? 'Урожай созрел. Нажмите «Собрать» на грядке.'
    : toPlant.length ? `Посадите недостающие культуры: ${toPlant.map(([id]) => goods[id].name.toLowerCase()).join(', ')}. <a href="#seed-shop">Купить семена</a>.`
    : 'Урожай растёт. Полейте грядки, чтобы собрать его раньше.';
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
      Object.assign(bed, {
        crop: selected, readyAt: now + crops[selected].time * 1000,
        yield: crops[selected].yield, watered: false,
      });
      break;
    case 'water':
      if (!bed?.crop || bed.watered || bed.readyAt <= now) return;
      bed.readyAt = now + Math.round((bed.readyAt - now) * (save.wateringUpgrade ? 0.55 : 0.75));
      bed.watered = true;
      break;
    case 'harvest':
      if (!bed?.crop || bed.readyAt > now) return;
      save.stock[bed.crop] += bed.yield ?? 1;
      save.beds[id] = { open: true, crop: null };
      break;
    case 'unlockBed':
      if (!bed || bed.open || Number(id) !== save.beds.findIndex(plot => !plot.open) || save.coins < bedCosts[id]) return;
      save.coins -= bedCosts[id];
      bed.open = true;
      break;
    case 'upgradeWater':
      if (save.wateringUpgrade || save.coins < wateringCost) return;
      save.coins -= wateringCost;
      save.wateringUpgrade = true;
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
    case 'takeOrder':
    case 'cancelOrder':
    case 'order': {
      const [slot] = id.split('-');
      if (!Object.hasOwn(market, slot) || (slot === 'special' && save.market.reputation < specialReputation)) return;
      const order = getOffer(save, slot);
      if (id !== order.id) return;
      if (action === 'takeOrder') {
        if (save.market.active) return;
        save.market.active = slot;
        break;
      }
      if (save.market.active !== slot) return;
      if (action === 'order') {
        if (!hasItems(save, order.need)) return;
        for (const [item, count] of Object.entries(order.need)) save.stock[item] -= count;
        save.coins += order.reward;
        save.market.reputation++;
        save.market.positions[slot]++;
      }
      save.market.active = null;
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
    sell: 'Товар продан', order: 'Заказ выполнен · +1 репутация',
    takeOrder: 'Заказ взят', cancelOrder: 'Заказ отменён', upgradeWater: 'Лейка улучшена',
  };
  if (messages[action]) {
    byId('notice').textContent = messages[action];
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { byId('notice').textContent = ''; }, 2200);
  }
}

document.addEventListener('click', async event => {
  const item = event.target.closest('button[data-action]');
  if (!item || item.disabled) return;
  const { action, id } = item.dataset;
  if (action === 'select') selected = id;
  else if (navigator.locks) await navigator.locks.request(key, () => transact(action, id));
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
