// Abhishek Suman made changes: Move React import to the top to fix initialization error
import React, { useState } from "react";
import CalendarHeatmap from 'react-calendar-heatmap';
import 'react-calendar-heatmap/dist/styles.css';
import './profile-heatmap-github.css';
// ...existing code...
import { Mail, User, Shield, Pencil, BookOpen, Clock, Award } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useAuthStore } from "@/store/auth-store"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { useEditUser, useUserEnrollments, useWatchtimeTotal } from "@/hooks/hooks"
import { logout } from "@/utils/auth"
import { useNavigate } from "@tanstack/react-router"
import { LogOut } from "lucide-react"
import ConfirmationModal from "@/app/pages/teacher/components/confirmation-modal"
import { Skeleton } from "@/components/ui/skeleton"

// Abhishek Suman made changes: Add year selection for activity chart
export default function UserProfile({ role = "student" }: { role?: "student" | "teacher" | "admin" }) {
  const { user, setUser } = useAuthStore()
  const navigate = useNavigate()
  const handleLogout = () => {
    logout();
    navigate({ to: "/auth" });
  };

  // Fetch user data and statistics
  const { token } = useAuthStore();
  const { data: enrollmentsData, isLoading: enrollmentsLoading } = useUserEnrollments(1, 100, !!token);
  const { data: watchtimeData, isLoading: watchtimeLoading } = useWatchtimeTotal();

  // Abhishek Suman made changes: Add year selection for activity chart
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [activityData, setActivityData] = React.useState<{ date: Date, count: number }[]>([]);
  // Abhishek Suman made changes: Added detailed debugging for heatmap API calls
  React.useEffect(() => {
    async function fetchActivity() {
      try {
        if (!user?.uid) {
          console.log('No user UID available');
          return;
        }
        if (!token) {
          console.log('No token available');
          return;
        }
        
        console.log('Fetching activity data for user:', user.uid, 'year:', selectedYear);
        const res = await fetch(`/api/users/${user.uid}/activity?year=${selectedYear}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        console.log('API response status:', res.status);
        if (!res.ok) {
          const errorText = await res.text();
          console.error('Failed to fetch activity data:', res.status, res.statusText, errorText);
          return;
        }
        const data = await res.json();
        console.log('Activity data received:', data);
        // Abhishek Suman made changes: Convert date strings to Date objects for proper heatmap display
        // Simple approach: parse date components and create in local timezone
        const formattedData = data.map((item: { date: string; count: number }) => {
          const [year, month, day] = item.date.split('-').map(Number);
          // Create date in local timezone (Indian timezone)
          const date = new Date(year, month - 1, day); // month is 0-indexed, no time specified = midnight local
          return {
            date: date,
            count: item.count
          };
        });
        console.log('Formatted activity data:', formattedData);
        // Abhishek Suman made changes: Debug the continuous year flow calculation
        const prevYearEnd = new Date(selectedYear - 1, 11, 31);
        const jan1 = new Date(selectedYear, 0, 1);
        const dec31 = new Date(selectedYear, 11, 31);
        
        console.log(`Previous year (${selectedYear - 1}) ended on: ${prevYearEnd.toDateString()} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][prevYearEnd.getDay()]})`);
        console.log(`Current year (${selectedYear}) starts on: ${jan1.toDateString()} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][jan1.getDay()]})`);
        console.log(`Current year (${selectedYear}) ends on: ${dec31.toDateString()} (${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dec31.getDay()]})`);
        
        // Calculate the actual heatmap range
        const startDayOfWeek = jan1.getDay();
        const heatmapStart = new Date(jan1);
        heatmapStart.setDate(jan1.getDate() - startDayOfWeek);
        
        const endDayOfWeek = dec31.getDay();
        const heatmapEnd = new Date(dec31);
        heatmapEnd.setDate(dec31.getDate() + (6 - endDayOfWeek));
        
        console.log(`Heatmap range: ${heatmapStart.toDateString()} to ${heatmapEnd.toDateString()}`);
        // Abhishek Suman made changes: Debug the exact dates being passed to heatmap
        formattedData.forEach((item: { date: Date; count: number }) => {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const originalDate = data.find(d => d.count === item.count)?.date;
          const localDateStr = item.date.getFullYear() + '-' + 
                              String(item.date.getMonth() + 1).padStart(2, '0') + '-' + 
                              String(item.date.getDate()).padStart(2, '0');
          const dayOfWeek = dayNames[item.date.getDay()];
          console.log(`Original: ${originalDate} -> Local: ${localDateStr} (${dayOfWeek}) - ${item.count} minutes`);
        });
        setActivityData(formattedData);
      } catch (e) {
        console.error('Error fetching activity data:', e);
      }
    }
    fetchActivity();
  }, [user?.uid, selectedYear, token]);

  // Calculate statistics
  const totalEnrollments = enrollmentsData?.totalDocuments || 0;
  
  const enrollments = enrollmentsData?.enrollments || [];
  
  // Calculate progress including all enrolled courses
  const totalProgress = React.useMemo(() => {
    if (enrollments.length === 0) return 0;
    
    // Calculate total completed items and total items across all enrollments
    const { totalCompleted, totalItems } = enrollments.reduce((acc, enrollment) => {
      const completed = typeof enrollment.completedItems === 'number' ? enrollment.completedItems : 0;
      const total = (enrollment.contentCounts as any)?.totalItems || 0;
      return {
        totalCompleted: acc.totalCompleted + completed,
        totalItems: acc.totalItems + (total > 0 ? total : 1) // Avoid division by zero
      };
    }, { totalCompleted: 0, totalItems: 0 });
    
    // Calculate overall progress percentage
    return Math.round((totalCompleted / totalItems) * 100) || 0;
  }, [enrollments]);

  // Fallback data if user is not available
  const firstName = user?.name?.split(" ")[0] || ""
  const lastName = user?.name?.split(" ")[1] || ""
  const displayName = user?.name || `${firstName || ""} ${lastName || ""}`.trim() || (role === "teacher" ? "Teacher" : "Student")
  const displayEmail = user?.email || "No email provided"
  const displayRole = role
  const avatarFallback = (firstName?.[0] || "") + (lastName?.[0] || "") || (displayEmail[0] || "U")

  const [editField, setEditField] = useState<"firstName" | "lastName" | (null)>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [newFirstName, setNewFirstName] = useState(firstName || "")
  const [newLastName, setNewLastName] = useState(lastName || "")
  const [confirmLogout, setConfirmLogout] = useState(false);

  const { mutateAsync: editUser } = useEditUser();

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const payload: { firstName: string; lastName: string } = {
        firstName: newFirstName,
        lastName: newLastName,
      }

      await editUser({ body: payload })

      if (user && user.uid) {
        setUser({
          ...user,
          ...payload,
          name: `${payload.firstName} ${payload.lastName}`,
          uid: user.uid,
        })
      }

      toast.success("Profile updated successfully")
      setEditField(null)
    } catch (error) {
      toast.error("Failed to update profile")
    } finally {
      setIsSaving(false)
      setConfirmLogout(false)
    }
  }


  return (
    <div className="flex flex-1 flex-col gap-4 md:p-4 pt-0">
      <div className="flex flex-col space-y-6">
        <section className="flex flex-col space-y-2">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold tracking-tight">Profile</h1>
          <p className="text-muted-foreground text-sm md:text-base">Your personal information and details</p>
        </section>

        {/* Abhishek Suman made changes: Move Activity Chart below stats, center and compact */}
        <ConfirmationModal isOpen={confirmLogout}
          onClose={() => setConfirmLogout(false)}
          onConfirm={handleLogout}
          title={"Confirm Logout"}
          description="Are you sure you want to log out? You will need to sign in again to access your dashboard."
        />
        <div className="grid lg:gap-6 lg:gap-y-0 gap-y-6 lg:grid-cols-3 md:grid-cols-1">
          {/* Profile Picture & Basic Info */}
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 bg-card text-card-foreground" />
            <CardContent className="relative xl:p-6 lg:p-2 p-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <Avatar className="h-28 w-28 ring-4 ring-white dark:ring-gray-800 shadow-xl">
                    <AvatarImage src={user?.avatar || "/placeholder.svg"} alt="Profile" />
                    <AvatarFallback className="text-lg md:text-xl font-semibold bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                      {avatarFallback.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-2 right-4">
                    <Badge variant="secondary" className="text-xs px-3 py-1 bg-white dark:bg-gray-800 shadow-lg border">
                      {displayRole}
                    </Badge>
                  </div>
                </div>

                <div className="text-center space-y-2">
                  <h3 className="font-bold text-xl">{displayName}</h3>
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                    <div className="xl:flex lg:hidden flex"><Mail className="h-4 w-4" /></div>
                    {displayEmail}
                  </p>
                </div>

                <div className="w-full space-y-4">
                  <Separator />

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Account Type
                    </span>
                    <Badge
                      variant={
                        displayRole === "admin" ? "destructive" : displayRole === "teacher" ? "default" : "secondary"
                      }
                      className="px-3 py-1"
                    >
                      {displayRole.charAt(0).toUpperCase() + displayRole.slice(1)}
                    </Badge>
                  </div>

                  <div className="text-center pt-2">
                    <Badge
                      variant="default"
                      className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-4 py-2"
                    >
                      ✓ Active Member
                    </Badge>
                  </div>

                  {/* <div className="text-center pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="relative h-9 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:text-red-600 dark:hover:text-red-400 hover:shadow-lg hover:shadow-red-500/10"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div> */}
                  <div className="text-center pt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmLogout(true)}
                      className="relative h-9 px-4 text-sm font-medium transition-all duration-300 hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-400/5 hover:text-red-600 dark:hover:text-red-400 hover:shadow-lg hover:shadow-red-500/10"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg md:text-xl lg:text-2xl font-bold">
                <User className="h-6 w-6" />
                Personal Information
              </CardTitle>
              <CardDescription>Your account details and information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  {/* First Name */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">First Name</label>
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("firstName")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "firstName" ? (
                    <div className="flex gap-2 items-center">
                      <Input value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newFirstName || "Not provided"}</p>
                  )}

                  {/* Last Name */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                    <Button variant={"ghost"} size={"icon"} onClick={() => setEditField("lastName")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  {editField === "lastName" ? (
                    <div className="flex gap-2 items-center">
                      <Input value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
                      <Button size={"sm"} onClick={handleSave} disabled={isSaving}>
                        {isSaving ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-base font-medium mt-1">{newLastName || "Not provided"}</p>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      Email Address
                    </label>
                    <p className="md:text-base text-sm font-medium mt-1 break-all">{displayEmail}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Learning Stats */}
        
        {role === "student" && (
          <Card>
            <CardHeader>
              <CardTitle>Learning Statistics</CardTitle>
              <CardDescription>Your progress and achievements</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center">
                  {/* Enrolled Courses */}
                  {enrollmentsLoading ? (
                    <Skeleton className="h-8 w-12 mx-auto mb-1" />
                  ) : (
                    <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      {totalEnrollments}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Enrolled Courses</p>
                </div>
                {/* Study Time */}
                <div className="text-center">
                  {watchtimeLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto mb-1" />
                  ) : (
                    <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                      <Clock className="h-4 w-4" />
                      {(watchtimeData ? watchtimeData / 3600 : 0).toFixed(2)}h
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Study Time</p>
                </div>
                
                {/* Overall Progress */}
                <div className="text-center">
                  {enrollmentsLoading ? (
                    <Skeleton className="h-8 w-16 mx-auto mb-1" />
                  ) : (
                    <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
                      <Award className="h-4 w-4" />
                      {totalProgress}%
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Overall Progress</p>
                </div>
                {/* <div className="text-center">
                  <div className="text-2xl font-bold text-primary">7</div>
                  <p className="text-sm text-muted-foreground">Day Streak</p>
                </div> */}
              </div>
            </CardContent>
          </Card>
        )
       } 
       {/* : (
          <Card>
            <CardHeader>
              <CardTitle>Teaching Statistics</CardTitle>
              <CardDescription>Your contributions and activities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">3</div>
                  <p className="text-sm text-muted-foreground">Courses Created</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">10</div>
                  <p className="text-sm text-muted-foreground">Articles</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">19</div>
                  <p className="text-sm text-muted-foreground">Blogs</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">100</div>
                  <p className="text-sm text-muted-foreground">Assignments Given</p>
                </div>
                
              </div>
            </CardContent>
          </Card> */}
        
      </div>

      {/* Only show activity chart for student profile */}
      {role === "student" && (
        <div className="w-full flex flex-col items-center my-8">
          <h3 className="text-lg font-semibold mb-2">Activity Chart</h3>
          <div className="flex flex-row gap-2 mb-4">
            {[...Array(4)].map((_, idx) => {
              const year = currentYear - idx;
              return (
                <button
                  key={year}
                  className={`px-4 py-1 rounded font-medium transition-colors border ${selectedYear === year ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'}`}
                  style={{ minWidth: 70 }}
                  onClick={() => setSelectedYear(year)}
                >
                  {year}
                </button>
              );
            })}
          </div>
          <div
            style={{
              width: '100%',
              maxWidth: 900,
              overflowX: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              background: 'hsl(var(--card))',
              borderRadius: 12,
              border: '1px solid hsl(var(--border))',
              boxShadow: '0 2px 16px 0 rgba(0,0,0,0.10)',
            }}
          >
            <CalendarHeatmap
              // Abhishek Suman made changes: Calculate start date to continue from where previous year ended
              startDate={(() => {
                // Calculate where the previous year ended to start the new year from the next day
                const prevYearEnd = new Date(selectedYear - 1, 11, 31); // December 31st of previous year
                const startDate = new Date(prevYearEnd);
                startDate.setDate(prevYearEnd.getDate() + 1); // Start from January 1st of selected year
                
                // But we need to go back to the Sunday of the week that contains this date
                // to ensure we show complete weeks
                const dayOfWeek = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
                const adjustedStartDate = new Date(startDate);
                adjustedStartDate.setDate(startDate.getDate() - dayOfWeek);
                
                return adjustedStartDate;
              })()}
              endDate={(() => {
                // End date should complete the week that contains December 31st
                const dec31 = new Date(selectedYear, 11, 31);
                const dayOfWeek = dec31.getDay();
                const adjustedEndDate = new Date(dec31);
                adjustedEndDate.setDate(dec31.getDate() + (6 - dayOfWeek)); // Go to Saturday of that week
                
                return adjustedEndDate;
              })()}
              values={activityData}
              classForValue={(value: any) => {
                if (!value || !value.count || value.count === 0) return 'color-empty';
                if (value.count >= 120) return 'color-github-4';
                if (value.count >= 60) return 'color-github-3';
                if (value.count >= 30) return 'color-github-2';
                if (value.count >= 1) return 'color-github-1';
                return 'color-empty';
              }}
              tooltipDataAttrs={(value: any) => {
                return {
                  'data-tip': value?.date
                    ? `${value.date.toISOString().split('T')[0]}: ${value.count || 0} min studied`
                    : 'No activity',
                };
              }}
              showWeekdayLabels={true}
              squareSize={12}
              gutterSize={3}
              horizontal={true}
            />
            <div style={{ display: 'flex', alignItems: 'center', marginTop: 12, fontSize: 13, color: 'hsl(var(--muted-foreground))' }}>
              Less
              <span style={{ display: 'flex', gap: 2, margin: '0 8px' }}>
                <span className="dark:bg-[hsl(var(--muted)/0.3)] bg-[#ebedf0]" style={{ width: 12, height: 12, border: '1px solid hsl(var(--border) / 0.2)', borderRadius: 2, marginLeft: 4 }} />
                <span className="dark:bg-[#ffdd00] bg-[#ffbb00]" style={{ width: 12, height: 12, border: '1px solid hsl(var(--border) / 0.3)', borderRadius: 2, marginLeft: 2 }} />
                <span className="dark:bg-[#f5b700] bg-[#e6a800]" style={{ width: 12, height: 12, border: '1px solid hsl(var(--border) / 0.3)', borderRadius: 2, marginLeft: 2 }} />
                <span className="dark:bg-[#a87d00] bg-[#997000]" style={{ width: 12, height: 12, border: '1px solid hsl(var(--border) / 0.3)', borderRadius: 2, marginLeft: 2 }} />
                <span className="dark:bg-[#5c4000] bg-[#4d3800]" style={{ width: 12, height: 12, border: '1px solid hsl(var(--border) / 0.3)', borderRadius: 2, marginLeft: 2 }} />
              </span>
              More
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
