import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TrendingUp, CalendarIcon, Loader2 } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Area, AreaChart, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

interface VisitDataPoint {
    date: string;
    visitas: number;
    fullDate: string;
}

type FilterPeriod = '7d' | '30d' | 'custom';

const chartConfig = {
    visitas: {
        label: 'Visitas',
        color: 'hsl(var(--primary))',
    },
};

const VisitsChart = () => {
    const [data, setData] = useState<VisitDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState<FilterPeriod>('7d');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: subDays(new Date(), 7),
        to: new Date(),
    });
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);

    const dateFilter = useMemo(() => {
        if (period === '7d') {
            return { from: subDays(new Date(), 7), to: new Date() };
        } else if (period === '30d') {
            return { from: subDays(new Date(), 30), to: new Date() };
        } else {
            return dateRange || { from: subDays(new Date(), 7), to: new Date() };
        }
    }, [period, dateRange]);

    useEffect(() => {
        fetchVisitsData();
    }, [dateFilter]);

    const fetchVisitsData = async () => {
        setLoading(true);
        try {
            const fromDate = format(startOfDay(dateFilter.from!), 'yyyy-MM-dd');
            const toDate = format(endOfDay(dateFilter.to!), 'yyyy-MM-dd');

            const { data: visitas, error } = await supabase
                .from('visitas')
                .select('data_visita')
                .gte('data_visita', fromDate)
                .lte('data_visita', toDate)
                .is('deleted_at', null);

            if (error) throw error;

            // Aggregate by date
            const countByDate: Record<string, number> = {};

            // Initialize all dates in range with 0
            let currentDate = new Date(dateFilter.from!);
            while (currentDate <= dateFilter.to!) {
                const dateKey = format(currentDate, 'yyyy-MM-dd');
                countByDate[dateKey] = 0;
                currentDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);
            }

            // Count visits per date
            visitas?.forEach((visita) => {
                const dateKey = visita.data_visita;
                if (countByDate[dateKey] !== undefined) {
                    countByDate[dateKey]++;
                }
            });

            // Convert to chart data
            const chartData: VisitDataPoint[] = Object.entries(countByDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([fullDate, count]) => ({
                    date: format(new Date(fullDate + 'T12:00:00'), 'dd/MM', { locale: ptBR }),
                    visitas: count,
                    fullDate,
                }));

            setData(chartData);
        } catch (error) {
            console.error('Error fetching visits data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePeriodChange = (value: string) => {
        if (value) {
            setPeriod(value as FilterPeriod);
            if (value !== 'custom') {
                setIsCalendarOpen(false);
            }
        }
    };

    const handleDateRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range);
        if (range?.from && range?.to) {
            setPeriod('custom');
            setIsCalendarOpen(false);
        }
    };

    const totalVisitas = data.reduce((acc, d) => acc + d.visitas, 0);

    return (
        <Card className="glass-card">
            <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center">
                            <TrendingUp className="mr-2 h-5 w-5" />
                            Visitas Recentes
                        </CardTitle>
                        <CardDescription>
                            {totalVisitas} visitas no período selecionado
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <ToggleGroup
                            type="single"
                            value={period}
                            onValueChange={handlePeriodChange}
                            className="bg-muted/50 rounded-lg p-1"
                        >
                            <ToggleGroupItem
                                value="7d"
                                className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                            >
                                7 dias
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="30d"
                                className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:shadow-sm"
                            >
                                30 dias
                            </ToggleGroupItem>
                        </ToggleGroup>
                        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={period === 'custom' ? 'default' : 'outline'}
                                    size="sm"
                                    className={cn(
                                        "h-8 px-3",
                                        period === 'custom' && "bg-primary text-primary-foreground"
                                    )}
                                >
                                    <CalendarIcon className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={handleDateRangeSelect}
                                    numberOfMonths={2}
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex items-center justify-center h-[250px]">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mb-2 opacity-50" />
                        <p>Nenhuma visita no período</p>
                    </div>
                ) : (
                    <ChartContainer config={chartConfig} className="h-[250px] w-full">
                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="visitasGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                                tickMargin={8}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 12 }}
                                tickMargin={8}
                                allowDecimals={false}
                            />
                            <ChartTooltip
                                content={
                                    <ChartTooltipContent
                                        labelFormatter={(value, payload) => {
                                            if (payload?.[0]?.payload?.fullDate) {
                                                return format(
                                                    new Date(payload[0].payload.fullDate + 'T12:00:00'),
                                                    "dd 'de' MMMM",
                                                    { locale: ptBR }
                                                );
                                            }
                                            return value;
                                        }}
                                    />
                                }
                            />
                            <Area
                                type="monotone"
                                dataKey="visitas"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                fill="url(#visitasGradient)"
                                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 3 }}
                                activeDot={{ r: 5, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ChartContainer>
                )}
            </CardContent>
        </Card>
    );
};

export default VisitsChart;
