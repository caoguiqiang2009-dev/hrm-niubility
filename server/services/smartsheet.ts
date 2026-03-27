import axios from 'axios';
import { wecomConfig } from '../config/wecom';
import { getAccessToken } from './wecom';

const API = wecomConfig.apiBase;

// ── 获取智能表格字段列表 ────────────────────────────────────────
export async function getSheetFields(docid: string, sheetId: string) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/get_fields?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`获取字段失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.fields || [];
}

// ── 查询记录 ──────────────────────────────────────────────────
export async function getRecords(docid: string, sheetId: string, opts?: { offset?: number; limit?: number; viewId?: string }) {
  const token = await getAccessToken();
  const body: any = { docid, sheet_id: sheetId };
  if (opts?.offset) body.offset = opts.offset;
  if (opts?.limit) body.limit = opts.limit;
  if (opts?.viewId) body.view_id = opts.viewId;
  // Use field title as key for readability
  body.key_type = 'CELL_VALUE_KEY_TYPE_FIELD_TITLE';

  const res = await axios.post(`${API}/wedoc/smartsheet/get_records?access_token=${token}`, body);
  if (res.data.errcode !== 0) {
    throw new Error(`查询记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return {
    records: res.data.records || [],
    total: res.data.total || 0,
    has_more: res.data.has_more || false,
  };
}

// ── 添加记录 ──────────────────────────────────────────────────
export async function addRecords(docid: string, sheetId: string, records: any[]) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/add_records?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
    key_type: 'CELL_VALUE_KEY_TYPE_FIELD_TITLE',
    records,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`添加记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.records || [];
}

// ── 更新记录 ──────────────────────────────────────────────────
export async function updateRecords(docid: string, sheetId: string, records: any[]) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/update_records?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
    key_type: 'CELL_VALUE_KEY_TYPE_FIELD_TITLE',
    records,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`更新记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return res.data.records || [];
}

// ── 删除记录 ──────────────────────────────────────────────────
export async function deleteRecords(docid: string, sheetId: string, recordIds: string[]) {
  const token = await getAccessToken();
  const res = await axios.post(`${API}/wedoc/smartsheet/delete_records?access_token=${token}`, {
    docid,
    sheet_id: sheetId,
    record_ids: recordIds,
  });
  if (res.data.errcode !== 0) {
    throw new Error(`删除记录失败: ${res.data.errmsg} (${res.data.errcode})`);
  }
  return true;
}
