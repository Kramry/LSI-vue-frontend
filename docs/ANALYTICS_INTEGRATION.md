# SmartTrack Analytics Module - Frontend Integration

This document explains the analytics module integration in the Vue.js frontend.

## Overview

The analytics module provides comprehensive data visualization and reporting for the SmartTrack training management system. It connects to the PHP backend API to fetch real-time analytics data.

## Features Implemented

### 1. Attendance Analytics
- Daily attendance trend visualization (line chart)
- Attendance status breakdown (doughnut chart)
- Trainee monitoring table with attendance rates
- Class overview with performance metrics

### 2. Payment Analytics (Admin/Staff only)
- Net payments received
- Outstanding balance tracking
- Bond deposits and refunds
- Collections by day (bar chart)
- Payments by fee type (doughnut chart)
- Payment method breakdown

### 3. Training Analytics (Admin/Staff only)
- Total enrolled trainees
- Active vs inactive trainees
- Training completion rates
- Monthly enrollment trends (line chart)
- Program popularity (bar chart)
- Trainees per training batch

### 4. Document Analytics (Admin/Staff only)
- Total submitted documents
- Verification status (verified, rejected, pending)
- Missing documents tracking
- Document completion rates by class
- Document types distribution (bar chart)

### 5. Certificate Analytics (Admin/Staff only)
- Total certificates issued
- Pending certificate generation
- Revoked certificates
- Monthly certificate issuance (line chart)
- Certificate status distribution (doughnut chart)
- Eligibility statistics

### 6. Announcement Analytics (Admin/Staff only)
- Total published announcements
- Email and SMS notification counts
- Read vs unread notifications
- Failed notification tracking
- Announcement readership statistics

## Technology Stack

- **Frontend Framework:** Vue 3 with Composition API
- **Language:** TypeScript
- **Charts:** Chart.js 4.4.0 with vue-chartjs 5.3.0
- **API Integration:** Custom API service
- **Build Tool:** Vite

## File Structure

```
src/
├── views/
│   └── Analytics.vue          # Main analytics component
├── services/
│   ├── api.ts                  # API service functions
│   └── api.d.ts                # TypeScript API definitions
└── config.ts                   # API base URL configuration
```

## Installation

The analytics module requires the following dependencies:

```bash
npm install chart.js vue-chartjs
```

These are already included in `package.json`:
- `chart.js@^4.4.0`
- `vue-chartjs@^5.3.0`

## API Endpoints

### Get Analytics Data

**Endpoint:** `GET /api/analytics`

**Query Parameters:**
- `start_date` (required): Start date in YYYY-MM-DD format
- `end_date` (required): End date in YYYY-MM-DD format
- `class_id` (optional): Filter by specific class ID

**Example:**
```typescript
const response = await apiGet<AnalyticsData>('/analytics?start_date=2024-01-01&end_date=2024-12-31')
```

## Component Structure

### Analytics.vue

The main analytics component is structured as follows:

```typescript
// Data interfaces
interface AnalyticsData {
  filters: { start_date: string; end_date: string; class_id: number | null }
  class_options: Array<{ class_id: number; class_name: string }>
  summary: { ... }
  trend: Array<{ ... }>
  status: Record<string, number>
  classes: Array<Record<string, string | number>>
  trainees: Array<Record<string, string | number | null>>
  payments?: { ... }
  training?: { ... }
  documents?: { ... }
  certificates?: { ... }
  announcements?: { ... }
}
```

### Key Features

#### 1. Reactive Data Loading
```typescript
const loading = ref(false)
const error = ref('')
const data = ref<AnalyticsData | null>(null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const query = new URLSearchParams({ start_date: startDate.value, end_date: endDate.value })
    if (classId.value) query.set('class_id', classId.value)
    const response = await apiGet<AnalyticsData>(`/analytics?${query}`)
    data.value = response.data
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : 'Unable to load analytics.'
  } finally {
    loading.value = false
  }
}
```

#### 2. Chart.js Integration
```typescript
import { Line, Doughnut, Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler } from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, Filler)

// Chart data configuration
const attendanceTrendData = computed(() => ({
  labels: data.value?.trend.map(item => item.label) || [],
  datasets: [
    { label: 'Present', data: data.value?.trend.map(item => item.present) || [], borderColor: '#2d8a57', backgroundColor: '#2d8a57', tension: 0.25 },
    { label: 'Late', data: data.value?.trend.map(item => item.late) || [], borderColor: '#d99100', backgroundColor: '#d99100', tension: 0.25 },
    { label: 'Absent', data: data.value?.trend.map(item => item.absent) || [], borderColor: '#c4372c', backgroundColor: '#c4372c', tension: 0.25 }
  ]
}))
```

#### 3. Export to Excel
```typescript
function exportToExcel() {
  if (!data.value) {
    alert('Please wait for analytics data to load before exporting.')
    return
  }
  let csv = 'Analytics Report\n'
  csv += `Generated: ${new Date().toISOString()}\n`
  csv += `Date Range: ${startDate.value} to ${endDate.value}\n\n`
  
  // Add data sections...
  
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `analytics_report_${startDate.value}_to_${endDate.value}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
```

## Usage

### Basic Usage

1. Navigate to the Analytics page in the application
2. The page automatically loads the last 30 days of data
3. Use the date range filters to adjust the period
4. Optionally filter by class
5. Click "Apply filters" to refresh the data
6. Click "Export Excel" to download the data as CSV

### Date Range Limitations

- Maximum date range: 366 days (1 year + 1 day)
- Start date must be before or equal to end date
- Format: YYYY-MM-DD

### Role-Based Access

Analytics sections are filtered based on user role:
- **Administrator:** Full access to all analytics
- **Staff:** Full access to all analytics
- **Instructor:** Limited to their assigned classes only

## Customization

### Adding New Analytics Sections

1. Update the `AnalyticsData` interface in `Analytics.vue`:
```typescript
interface AnalyticsData {
  // ... existing fields
  newSection?: {
    summary: { ... }
    details: Array<{ ... }>
  }
}
```

2. Add chart data configuration:
```typescript
const newSectionChartData = computed(() => ({
  labels: data.value?.newSection?.details.map(item => item.label) || [],
  datasets: [{ label: 'Metric', data: data.value?.newSection?.details.map(item => item.value) || [], backgroundColor: '#color' }]
}))
```

3. Add UI section in the template:
```vue
<section v-if="isFinance && data.newSection" class="finance section">
  <header class="finance-heading">
    <p class="eyebrow dark">SECTION / ANALYTICS</p>
    <h2>New Section</h2>
  </header>
  <!-- Add KPI cards, charts, and tables -->
</section>
```

### Customizing Chart Colors

Chart colors are defined in the dataset configurations. To change colors:

```typescript
const attendanceTrendData = computed(() => ({
  labels: data.value?.trend.map(item => item.label) || [],
  datasets: [
    { label: 'Present', data: data.value?.trend.map(item => item.present) || [], borderColor: '#your-color', backgroundColor: '#your-color', tension: 0.25 },
    // ...
  ]
}))
```

### Modifying Export Format

The `exportToExcel` function generates CSV data. To modify the format:

1. Add additional sections to the CSV generation
2. Change the delimiter (currently comma)
3. Add custom headers or footers

## Performance Optimization

### Chart Performance

- Charts are reactive and update automatically when data changes
- Chart instances are destroyed before recreation to prevent memory leaks
- Use computed properties for chart data to avoid unnecessary recalculations

### API Performance

- Data is only fetched when filters change
- Loading states prevent duplicate requests
- Error handling with user-friendly messages

## Troubleshooting

### Charts Not Displaying

**Issue:** Charts are not rendering

**Solutions:**
1. Verify Chart.js is installed: `npm list chart.js vue-chartjs`
2. Check browser console for errors
3. Ensure data is loaded before chart rendering
4. Verify Chart.js is properly registered

### API Errors

**Issue:** "Unable to load analytics" error

**Solutions:**
1. Check backend API is running
2. Verify API base URL in `src/config.ts`
3. Check network tab in browser dev tools
4. Verify authentication token is valid

### Export Not Working

**Issue:** Export button doesn't download file

**Solutions:**
1. Ensure data is loaded before clicking export
2. Check browser popup blocker
3. Verify CSV generation logic
4. Check browser console for errors

## Styling

The analytics component uses scoped CSS with CSS custom properties (variables) for theming:

```css
--navy: #173a60
--navy-deep: #112c49
--blue: #265f94
--sky: #8fc4f5
--text: #1b2a3a
--muted: #5d6f82
--line: #e1e8f1
--field: #eaf0fb
--ok: #2d8a57
--warn: #d99100
--danger: #c4372c
```

To customize colors, update these CSS variables in the component's `<style>` section.

## Responsive Design

The analytics dashboard is fully responsive:

- **Desktop (>900px):** Two-column layouts for charts and data
- **Tablet (600-900px):** Single-column layout
- **Mobile (<600px):** Stacked layout with single columns

## Integration with Backend

The frontend connects to the PHP backend via the API service defined in `src/services/api.ts`. The backend endpoints are:

- `GET /api/analytics` - Main analytics data endpoint
- `GET /api/session` - Session and authentication data

Ensure the backend API is running and accessible at the URL configured in `src/config.ts`.

## Development

### Running the Development Server

```bash
npm run dev
```

### Building for Production

```bash
npm run build
```

### Type Checking

```bash
npm run type-check
```

## Testing

To test the analytics module:

1. Start the backend API server
2. Start the frontend development server
3. Login with an admin or staff account
4. Navigate to the Analytics page
5. Test date range filters
6. Test class filters
7. Verify charts render correctly
8. Test export functionality
9. Test with instructor account (limited access)

## Support

For issues or questions:
1. Check this documentation
2. Review the backend documentation in `docs/ANALYTICS_MODULE.md`
3. Check the Metabase integration guide in `docs/METABASE_INTEGRATION.md`
4. Review the API responses in browser dev tools
5. Check browser console for JavaScript errors

## Future Enhancements

Potential future features:
- Real-time WebSocket updates for live analytics
- Custom dashboard builder
- Advanced drill-down capabilities
- Scheduled email reports
- More chart types (scatter, radar, heatmap)
- Data comparison between date ranges
- Customizable KPI cards
- Dark mode support
