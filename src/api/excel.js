import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export function getExcelData() {
  return axios.get(`${API_BASE_URL}/api/data`);
}
