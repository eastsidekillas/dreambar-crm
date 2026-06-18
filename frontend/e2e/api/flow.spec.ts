import { test, expect, request, APIRequestContext } from '@playwright/test';

const API = (process.env.E2E_API || 'http://127.0.0.1:8000') + '/api';

async function token(pin: string): Promise<string> {
  const ctx = await request.newContext();
  const res = await ctx.post(`${API}/auth/pin/`, { data: { pin } });
  expect(res.ok(), `PIN ${pin} login`).toBeTruthy();
  return (await res.json()).access;
}
async function authed(pin: string): Promise<APIRequestContext> {
  return request.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${await token(pin)}` } });
}
async function menu(api: APIRequestContext): Promise<Record<string, any>> {
  const cats = await (await api.get(`${API}/menu/items/by_category/`)).json();
  const items: Record<string, any> = {};
  for (const c of cats) for (const it of c.items) items[it.name] = it;
  return items;
}
async function shiftId(api: APIRequestContext): Promise<number> {
  return (await (await api.get(`${API}/shifts/current/`)).json()).id;
}
const list = (x: any) => (Array.isArray(x) ? x : x.results ?? x.active ?? []);

test('PIN-логин: верный проходит, неверный — 401', async () => {
  const ok = await (await request.newContext()).post(`${API}/auth/pin/`, { data: { pin: '1111' } });
  expect(ok.ok()).toBeTruthy();
  const bad = await (await request.newContext()).post(`${API}/auth/pin/`, { data: { pin: '0000' } });
  expect(bad.status()).toBe(401);
});

test('Заказ: открыть стол → добавить → закрыть (без депозита)', async () => {
  const api = await authed('1111');
  const items = await menu(api);
  const shift = await shiftId(api);

  const create = await api.post(`${API}/orders/`, { data: { shift, table_number: 'Стол 2', guests: 2, notes: '' } });
  expect(create.status()).toBe(201);
  const order = await create.json();

  const upd = await (await api.post(`${API}/orders/${order.id}/add_item/`,
    { data: { menu_item: items['Кола'].id, quantity: 2, guest_no: 0 } })).json();
  expect(upd.items.length).toBe(1);
  expect(Number(upd.items[0].unit_price)).toBe(200);

  const co = await api.post(`${API}/orders/${order.id}/checkout/`,
    { data: { bills: [{ item_ids: [upd.items[0].id], payment_method: 'cash' }] } });
  expect(co.ok()).toBeTruthy();
  const body = await co.json();
  expect(body.order.status).toBe('closed');
  expect(Number(body.receipts[0].total)).toBe(400);
  expect(Number(body.receipts[0].deposit_amount)).toBe(0);
});

test('Модификаторы поднимают цену позиции', async () => {
  const api = await authed('1111');
  const items = await menu(api);
  const shift = await shiftId(api);
  expect(items['Коктейль'].has_modifiers).toBe(true);

  const groups = await (await api.get(`${API}/menu/items/${items['Коктейль'].id}/modifier_groups/`)).json();
  const limon = groups.flatMap((g: any) => g.modifiers).find((m: any) => m.name === 'Лимон');

  const order = await (await api.post(`${API}/orders/`,
    { data: { shift, table_number: 'Стол 1', guests: 1, notes: '' } })).json();
  const upd = await (await api.post(`${API}/orders/${order.id}/add_item/`,
    { data: { menu_item: items['Коктейль'].id, quantity: 1, guest_no: 0, modifiers: [limon.id] } })).json();

  const it = upd.items.find((x: any) => x.menu_item === items['Коктейль'].id);
  expect(Number(it.unit_price)).toBe(550);   // 500 + 50

  // освобождаем стол
  await api.post(`${API}/orders/${order.id}/checkout/`,
    { data: { bills: [{ item_ids: upd.items.map((x: any) => x.id), payment_method: 'cash' }] } });
});

test('VIP-депозит: покрывает счёт + возврат + бронь закрывается + стол свободен', async () => {
  const api = await authed('1111');
  const items = await menu(api);
  const shift = await shiftId(api);

  const today = new Date().toISOString().slice(0, 10);
  const resvs = list(await (await api.get(`${API}/reservations/?date=${today}`)).json());
  const resv = resvs.find((r: any) => r.table_number === 'VIP 1');
  expect(resv, 'VIP-бронь на сегодня').toBeTruthy();
  expect(resv.deposit_paid).toBe(true);

  const order = await (await api.post(`${API}/orders/`,
    { data: { shift, table_number: 'VIP 1', guests: 2, notes: '', reservation: resv.id } })).json();
  const upd = await (await api.post(`${API}/orders/${order.id}/add_item/`,
    { data: { menu_item: items['Кола'].id, quantity: 1, guest_no: 0 } })).json();

  const body = await (await api.post(`${API}/orders/${order.id}/checkout/`,
    { data: { bills: [{ item_ids: upd.items.map((x: any) => x.id), payment_method: 'cash' }] } })).json();
  const r = body.receipts[0];
  expect(Number(r.total)).toBe(200);
  expect(Number(r.deposit_amount)).toBe(200);    // списано со счёта
  expect(Number(r.refund_amount)).toBe(2800);    // возврат неиспользованного депозита
  expect(body.order.status).toBe('closed');

  const resv2 = await (await api.get(`${API}/reservations/${resv.id}/`)).json();
  expect(resv2.status).toBe('completed');        // бронь закрыта

  const active = list(await (await api.get(`${API}/orders/active/`)).json());
  expect(active.some((o: any) => o.table_number === 'VIP 1')).toBe(false);   // стол свободен
});

test('Двойное открытие одного стола → 409', async () => {
  const api = await authed('1111');
  const shift = await shiftId(api);
  const r1 = await api.post(`${API}/orders/`, { data: { shift, table_number: 'Стол 1', guests: 1, notes: '' } });
  expect(r1.status()).toBe(201);
  const r2 = await api.post(`${API}/orders/`, { data: { shift, table_number: 'Стол 1', guests: 1, notes: '' } });
  expect(r2.status()).toBe(409);
  await api.delete(`${API}/orders/${(await r1.json()).id}/`);   // освобождаем пустой стол
});

test('Кухня: видит модификатор, помечает готовым', async () => {
  const waiter = await authed('1111');
  const items = await menu(waiter);
  const shift = await shiftId(waiter);

  const groups = await (await waiter.get(`${API}/menu/items/${items['Бургер'].id}/modifier_groups/`)).json();
  const medium = groups.flatMap((g: any) => g.modifiers).find((m: any) => m.name === 'Medium');

  const order = await (await waiter.post(`${API}/orders/`,
    { data: { shift, table_number: 'Стол 2', guests: 1, notes: '' } })).json();
  const upd = await (await waiter.post(`${API}/orders/${order.id}/add_item/`,
    { data: { menu_item: items['Бургер'].id, quantity: 1, guest_no: 0, modifiers: [medium.id] } })).json();
  await waiter.post(`${API}/orders/${order.id}/send/`, { data: {} });   // отправить на кухню

  const kitchen = await authed('2222');
  const board = await (await kitchen.get(`${API}/kitchen/orders/?type=kitchen`)).json();
  const ticket = board.active.find((t: any) => t.order_id === order.id);
  expect(ticket, 'тикет на кухне').toBeTruthy();
  const burger = ticket.items.find((i: any) => i.name === 'Бургер');
  expect(burger.modifiers).toContain('Medium');

  const mark = await kitchen.post(`${API}/kitchen/item/${burger.id}/status/`, { data: { status: 'ready' } });
  expect(mark.ok()).toBeTruthy();

  await waiter.post(`${API}/orders/${order.id}/checkout/`,
    { data: { bills: [{ item_ids: upd.items.map((x: any) => x.id), payment_method: 'cash' }] } });
});