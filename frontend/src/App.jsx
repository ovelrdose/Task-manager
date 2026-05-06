import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';



const formatDateForInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateFromInput = (dateStr) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};



// --- UTILS ---
const getISOWeekData = (dateInput) => {
  let date;
  if (!dateInput) {
    date = new Date();
  } else if (typeof dateInput === 'string') {
    date = parseDateFromInput(dateInput);
  } else {
    date = new Date(dateInput);
  }
  
  // Работаем с локальным временем
  const dayNum = date.getDay() || 7;
  const target = new Date(date);
  target.setDate(target.getDate() + 4 - dayNum);
  
  const yearStart = new Date(target.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  
  return { 
    week: weekNo, 
    year: target.getFullYear() 
  };
};

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

const isSameDay = (d1, d2) => d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();

export default function App() {
  // --- STATE ---
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedWeek, setSelectedWeek] = useState(getISOWeekData());
  const [author, setAuthor] = useState(localStorage.getItem('author') || 'Иван Иванов');
  const [isEditingAuthor, setIsEditingAuthor] = useState(false);
  const [authorInput, setAuthorInput] = useState(author);
  
  const [availableWeeks, setAvailableWeeks] = useState(new Set());
  const [tasks, setTasks] = useState([]);
  
  // Form
  const [form, setForm] = useState({ 
  id: null, 
  title: '', 
  description: '', 
  task_date: formatDateForInput(new Date())
});
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState({ report: false, submit: false });

  // Refs
  const authorRef = useRef(null);

  // --- API ---
  const fetchData = async () => {
    try {
      const wRes = await axios.get('/api/weeks/');
      setAvailableWeeks(new Set(wRes.data.map(w => `${w.year}-W${String(w.week).padStart(2, '0')}`)));
    } catch (err) { console.error(err); }
  };

  const loadTasks = async (y, w) => {
    if (!y || !w) return;
    try {
      const res = await axios.get(`/api/tasks/?year=${y}&week=${w}`);
      setTasks(res.data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { loadTasks(selectedWeek.year, selectedWeek.week); }, [selectedWeek]);

  // --- HANDLERS ---
const handleDayClick = (day) => {
  // day уже правильный (локальная дата)
  const dateStr = formatDateForInput(day);
  console.log('Выбрана дата:', day, '->', dateStr);
  
  const { year, week } = getISOWeekData(day);
  setSelectedWeek({ year, week });
  setCalendarOpen(false);
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setLoading(prev => ({ ...prev, submit: true }));
    
    try {
      const payload = { title: form.title.trim(), description: form.description.trim(), task_date: form.task_date };
      if (isEditing && form.id) await axios.put(`/api/tasks/${form.id}`, payload);
      else await axios.post('/api/tasks/', payload);
      
      resetForm();
      fetchData();
      loadTasks(selectedWeek.year, selectedWeek.week);
    } catch (err) { console.error(err); }
    setLoading(prev => ({ ...prev, submit: false }));
  };

const handleEdit = (task) => {
  setForm({ 
    id: task.id, 
    title: task.title, 
    description: task.description || '', 
    task_date: formatDateForInput(new Date(task.task_date))
  });
  setIsEditing(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

  const handleDelete = async (id) => {
    if (!window.confirm('Удалить задачу?')) return;
    await axios.delete(`/api/tasks/${id}`);
    fetchData();
    loadTasks(selectedWeek.year, selectedWeek.week);
  };

const resetForm = () => {
  setForm({ 
    id: null, 
    title: '', 
    description: '', 
    task_date: formatDateForInput(new Date())
  });
  setIsEditing(false);
};

  const downloadReport = async () => {
    setLoading(prev => ({ ...prev, report: true }));
    try {
      const res = await axios.post('/api/report/', { year: selectedWeek.year, week: selectedWeek.week, author }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `report_${selectedWeek.year}_w${selectedWeek.week}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) { alert('Ошибка экспорта'); }
    setLoading(prev => ({ ...prev, report: false }));
  };

  // Author Logic
  const saveAuthor = () => {
    setAuthor(authorInput);
    localStorage.setItem('author', authorInput);
    setIsEditingAuthor(false);
  };

  // Close author popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (authorRef.current && !authorRef.current.contains(event.target)) {
        setIsEditingAuthor(false);
        setAuthorInput(author); // Revert if cancelled
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [author]);

  // --- CALENDAR DAYS ---
const calendarDays = useMemo(() => {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  
  // Пн=0, Вс=6
  let startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  
  const days = [];
  // Дни предыдущего месяца
  for (let i = startOffset; i > 0; i--) {
    days.push(new Date(year, month, -i));
  }
  // Дни текущего месяца
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
}, [calendarDate]);

  // --- WEEK DAYS FOR TIMELINE ---
  const weekDays = useMemo(() => {
    const jan1 = new Date(selectedWeek.year, 0, 1);
    const daysOffset = (selectedWeek.week - 1) * 7;
    const approxDate = new Date(jan1.setDate(jan1.getDate() + daysOffset));
    const startOfWeek = getStartOfWeek(approxDate);
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [selectedWeek]);

  const weekLabel = useMemo(() => {
    if (weekDays.length === 0) return '';
    const start = weekDays[0];
    const end = weekDays[6];
    const format = { day: 'numeric', month: 'long' };
    return `${start.toLocaleDateString('ru-RU', format)} — ${end.toLocaleDateString('ru-RU', { ...format, year: 'numeric' })}`;
  }, [weekDays]);

  return (
    <div className="min-h-screen bg-[#F3F4F6] text-slate-800 font-sans selection:bg-blue-100">
      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8">
        
        {/* 1. HEADER */}
        <header className="flex items-center justify-between pb-4 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Task Log</h1>
            <p className="text-sm text-slate-500 mt-1">Личный дневник задач</p>
          </div>
          
          {/* Author Editable */}
          <div className="relative" ref={authorRef}>
            {!isEditingAuthor ? (
              <button 
                onClick={() => { setIsEditingAuthor(true); setAuthorInput(author); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition group"
              >
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <span className="text-sm font-medium text-slate-700 group-hover:text-blue-600 transition">{author}</span>
                <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition">✏️</span>
              </button>
            ) : (
              <div className="absolute right-0 top-full mt-2 bg-white p-2 rounded-xl shadow-xl border border-slate-200 z-50 flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                <input 
                  autoFocus
                  value={authorInput} 
                  onChange={e => setAuthorInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveAuthor()}
                  className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-32"
                  placeholder="Ваше имя"
                />
                <button onClick={saveAuthor} className="text-green-600 hover:bg-green-50 p-1.5 rounded-lg transition">✓</button>
              </div>
            )}
          </div>
        </header>

        {/* 2. FORM CARD */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden transition-all">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex justify-between items-center">
            <h2 className="font-semibold text-slate-700">{isEditing ? 'Редактирование задачи' : 'Новая запись'}</h2>
            {isEditing && <button onClick={resetForm} className="text-xs text-red-500 hover:text-red-700 font-medium">Отмена</button>}
          </div>
          
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Дата</label>
                <input 
                  type="date" 
                  value={form.task_date} 
                  onChange={e => setForm({...form, task_date: e.target.value})} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-slate-700"
                  required 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Задача</label>
                <input 
                  type="text" 
                  placeholder="Что было сделано?" 
                  value={form.title} 
                  onChange={e => setForm({...form, title: e.target.value})} 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition placeholder:text-slate-400"
                  required 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Подробности</label>
              <textarea 
                rows={3}
                placeholder="Детали, ссылки, статус..." 
                value={form.description} 
                onChange={e => setForm({...form, description: e.target.value})} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button 
                type="submit" 
                disabled={loading.submit}
                className="px-8 py-3 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 active:scale-95 transition shadow-lg shadow-slate-200 disabled:opacity-50"
              >
                {isEditing ? 'Сохранить изменения' : 'Добавить запись'}
              </button>
            </div>
          </form>
        </div>

        {/* 3. WEEK NAVIGATION */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <button 
                onClick={() => setCalendarOpen(!calendarOpen)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition border ${calendarOpen ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              >
                <span className="text-lg">📅</span>
                <span className="font-medium text-sm">{calendarOpen ? 'Закрыть календарь' : 'Выбрать неделю'}</span>
              </button>
              
              <div className="text-center md:text-left">
                <div className="text-sm font-bold text-slate-800">{weekLabel}</div>
                <div className="text-xs text-slate-400">Неделя {selectedWeek.week}, {selectedWeek.year}</div>
              </div>
            </div>

            <button 
              onClick={downloadReport} 
              disabled={loading.report || tasks.length === 0}
              className="w-full md:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition shadow-md shadow-emerald-100 disabled:opacity-50 disabled:shadow-none flex justify-center items-center gap-2"
            >
              {loading.report ? '' : '📥'} Скачать PDF
            </button>
          </div>

          {calendarOpen && (
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 animate-in fade-in slide-in-from-top-4 duration-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-800 capitalize">
                  {calendarDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })}
                </h3>
                <div className="flex gap-1">
                  <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">←</button>
                  <button onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">→</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
                  <div key={d} className="text-center text-xs font-bold text-slate-400 uppercase">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {calendarDays.map((day, i) => {
                  const isCurrent = isSameDay(day, new Date());
                  const dayIso = getISOWeekData(day);
                  const isWeek = dayIso.week === selectedWeek.week && dayIso.year === selectedWeek.year;
                  const isMonth = day.getMonth() === calendarDate.getMonth();
                  
                  return (
                    <button 
                      key={i} 
                      onClick={() => handleDayClick(day)}
                      className={`
                        aspect-square rounded-xl flex items-center justify-center text-sm font-medium transition relative
                        ${!isMonth ? 'text-slate-300' : 'text-slate-700'}
                        ${isWeek ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-slate-100'}
                        ${isCurrent && !isWeek ? 'ring-2 ring-blue-300 ring-offset-2' : ''}
                      `}
                    >
                      {day.getDate()}
                      {availableWeeks.has(`${dayIso.year}-W${String(dayIso.week).padStart(2, '0')}`) && !isWeek && isMonth && (
                        <span className="absolute bottom-1.5 w-1 h-1 bg-slate-400 rounded-full"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 4. TIMELINE (Fixed Layout) */}
        <div className="space-y-0 pb-12">
          {weekDays.map((day, idx) => {
            const dateStr = formatDateForInput(day);  // ← Используем локальную дату!
  const dayTasks = tasks.filter(t => t.task_date === dateStr);
            const isToday = isSameDay(day, new Date());

            return (
              <div key={idx} className="relative pl-10 md:pl-12 min-h-[80px]">
                {/* Vertical Line */}
                <div className={`absolute top-0 bottom-0 left-5 md:left-6 w-0.5 transition-colors ${isToday ? 'bg-blue-500' : 'bg-slate-200'}`}></div>

                {/* Date Circle */}
                <div className={`absolute top-0 left-0 w-10 h-10 md:w-12 md:h-12 -ml-[1px] md:-ml-[3px] rounded-full flex flex-col items-center justify-center border-2 bg-white z-10 transition-all ${isToday ? 'border-blue-500 text-blue-600 shadow-md scale-105' : 'border-slate-200 text-slate-400'}`}>
                  <span className="text-[9px] uppercase font-bold leading-none">{day.toLocaleDateString('ru-RU', { weekday: 'short' }).slice(0,2)}</span>
                  <span className="text-base md:text-lg font-bold leading-none">{day.getDate()}</span>
                </div>

                {/* Content Area */}
                <div className="pt-1 pb-6 ml-4 md:ml-6">
                  {dayTasks.length > 0 ? (
                    <div className="space-y-3">
                      {dayTasks.map(task => (
                        <div key={task.id} className="group bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-200 transition relative overflow-hidden">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h4 className="font-semibold text-slate-800 text-base">{task.title}</h4>
                              {task.description && (
                                <p className="text-sm text-slate-500 mt-1.5 whitespace-pre-wrap leading-relaxed">{task.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
                              <button onClick={() => handleEdit(task)} className="p-1.5 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition" title="Ред.">✏️</button>
                              <button onClick={() => handleDelete(task.id)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition" title="Удалить">🗑️</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    // Исправленный отступ для "День свободен"
                    <div className="pl-12 text-sm text-slate-300 italic font-medium py-2">
                      День свободен
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}