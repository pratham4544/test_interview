report_template = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Candidate Interview Report</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Google Fonts - Inter -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {{
            font-family: 'Inter', sans-serif;
            background-color: #f0f2f5; /* Light grey background */
            color: #333;
            line-height: 1.6;
        }}
        .container {{
            max-width: 900px;
            margin: 20px auto;
            background-color: #ffffff;
            border-radius: 12px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #1f2937 0%, #4b5563 100%); /* Dark gradient header */
            color: #ffffff;
            padding: 30px 40px;
            border-bottom: 5px solid #3b82f6; /* Accent blue line */
        }}
        .section-title {{
            font-size: 1.8rem;
            font-weight: 700;
            color: #1f2937; /* Dark text for titles */
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e5e7eb;
            display: flex;
            align-items: center;
        }}
        .section-title svg {{
            margin-right: 10px;
            color: #3b82f6; /* Blue icon */
        }}
        .card {{
            background-color: #f9fafb;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
            border: 1px solid #e5e7eb;
        }}
        .score-bar-container {{
            width: 100px;
            height: 100px;
            border-radius: 50%;
            background: conic-gradient(#3b82f6 {percentage_score:.2f}%, #e5e7eb {percentage_score:.2f}%);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: 600;
            color: #1f2937;
            position: relative;
        }}
        .score-bar-text {{
            background-color: #ffffff;
            border-radius: 50%;
            width: 85px;
            height: 85px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            z-index: 1;
        }}
        .feedback-item {{
            background-color: #ffffff;
            border-left: 4px solid #3b82f6;
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 6px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
            display: flex;
            align-items: flex-start;
        }}
        .feedback-item.negative {{
            border-left-color: #ef4444; /* Red for negative feedback */
        }}
        .feedback-icon {{
            margin-right: 10px;
            font-size: 1.2rem;
        }}
        .qa-block {{
            background-color: #ffffff;
            border-radius: 8px;
            padding: 25px;
            margin-bottom: 25px;
            box-shadow: 0 6px 15px rgba(0, 0, 0, 0.08);
            border: 1px solid #d1d5db;
        }}
        .qa-question {{
            font-size: 1.15rem;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
            position: relative;
            padding-left: 25px;
        }}
        .qa-question::before {{
            content: 'Q:';
            font-weight: 700;
            color: #3b82f6;
            position: absolute;
            left: 0;
        }}
        .qa-answer {{
            color: #4b5563;
            margin-bottom: 15px;
            position: relative;
            padding-left: 25px;
        }}
        .qa-answer::before {{
            content: 'A:';
            font-weight: 700;
            color: #10b981; /* Green for answer */
            position: absolute;
            left: 0;
        }}
        .qa-score {{
            font-weight: 600;
            color: #3b82f6;
            font-size: 0.95rem;
            text-align: right;
        }}
        .followup-block {{
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px dashed #d1d5db;
            background-color: #f3f4f6;
            border-radius: 6px;
            padding: 15px;
        }}
        .followup-block .qa-question {{
            font-size: 1rem;
            font-weight: 500;
            color: #374151;
        }}
        .followup-block .qa-answer {{
            font-size: 0.95rem;
            color: #6b7280;
        }}
        .improvement-list li {{
            background-color: #fff;
            padding: 12px 15px;
            border-radius: 6px;
            margin-bottom: 8px;
            border-left: 4px solid #f59e0b; /* Amber for improvement */
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
        }}
        .footer {{
            background-color: #374151;
            color: #ffffff;
            padding: 20px 40px;
            text-align: center;
            font-size: 0.85rem;
            border-top: 5px solid #3b82f6;
        }}
        /* SVG Icons for visual appeal */
        .icon {{
            display: inline-block;
            width: 20px;
            height: 20px;
            vertical-align: middle;
            margin-right: 8px;
        }}
    </style>
</head>
<body class="antialiased">
    <div class="container">
        <header class="header">
            <div class="flex items-center justify-between mb-4">
                <div class="text-3xl font-bold flex items-center">
                    <svg class="icon w-8 h-8 mr-2 text-indigo-400" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 .55.45 1 1 1h2v-6H9v-.5c0-.28-.22-.5-.5-.5s-.5.22-.5.5v.5h-1V9h3c.55 0 1-.45 1-1V6H9c-.55 0-1-.45-1-1s.45-1 1-1h6c.55 0 1 .45 1 1s-.45 1-1 1h-3v2.5c0 .28.22.5.5.5s.5-.22.5-.5V8h1v5c0 .55-.45 1-1 1h-2v1c0 .55-.45 1-1 1zm8.06-4.5c.34-.84.54-1.75.54-2.73 0-4.41-3.59-8-8-8-1.42 0-2.76.37-3.92 1.03L15 15.5V16c0 .55.45 1 1 1h2v-2.5c0-.28-.22-.5-.5-.5z"/>
                    </svg>
                    AIeta Interview Report
                </div>
                <img src="https://placehold.co/100x40/3b82f6/ffffff?text=Company+Logo" alt="Company Logo" class="rounded-md">
            </div>
            <h1 class="text-4xl font-extrabold mb-2">Candidate Interview Report</h1>
            <p class="text-lg text-gray-200">Detailed insights into candidate performance</p>
        </header>

        <main class="p-8">
            <section class="mb-8">
                <h2 class="section-title">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    Candidate Overview
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-gray-700">
                    <div class="card">
                        <p class="font-medium text-gray-500 text-sm">Candidate ID:</p>
                        <p class="text-lg font-semibold">{candidate_id}</p>
                    </div>
                    <div class="card">
                        <p class="font-medium text-gray-500 text-sm">Position Applied For:</p>
                        <p class="text-lg font-semibold">{position}</p>
                    </div>
                    <div class="card">
                        <p class="font-medium text-gray-500 text-sm">Interview Date:</p>
                        <p class="text-lg font-semibold">{interview_date}</p>
                    </div>
                    <div class="card col-span-1 md:col-span-2 lg:col-span-3">
                        <p class="font-medium text-gray-500 text-sm">Interviewer:</p>
                        <p class="text-lg font-semibold">{interviewer_name}</p>
                    </div>
                </div>
            </section>

            <section class="mb-8">
                <h2 class="section-title">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    Overall Performance
                </h2>
                <div class="card flex flex-col md:flex-row items-center justify-between p-6">
                    <div class="flex items-center space-x-6 mb-4 md:mb-0">
                        <div class="score-bar-container">
                            <div class="score-bar-text">{percentage_score:.0f}%</div>
                        </div>
                        <div>
                            <p class="text-xl font-bold text-gray-800">Average Score</p>
                            <p class="text-gray-600">Based on all interactions</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-4 text-center">
                        <div class="p-4 bg-blue-50 rounded-lg shadow-sm">
                            <p class="text-xs text-gray-500">Total Score</p>
                            <p class="text-lg font-semibold text-blue-700">{total_score}</p>
                        </div>
                        <div class="p-4 bg-green-50 rounded-lg shadow-sm">
                            <p class="text-xs text-gray-500">Max Possible</p>
                            <p class="text-lg font-semibold text-green-700">{max_possible_score}</p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="mb-8">
                <h2 class="section-title">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zm0-8h14V7H7v2z"/>
                    </svg>
                    Score Breakdown by Category
                </h2>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6" id="category-scores">
                    {category_averages_html}
                </div>
            </section>

            <section class="mb-8">
                <h2 class="section-title">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/>
                    </svg>
                    Interview Interactions
                </h2>
                <div id="interactions-container">
                    {interactions_html}
                </div>
            </section>

            <section class="mb-8">
                <h2 class="section-title">
                    <svg class="icon" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
                    </svg>
                    Areas for Improvement
                </h2>
                <ul class="list-none p-0 improvement-list" id="improvement-areas-list">
                    {improvement_areas_html}
                </ul>
            </section>
        </main>

        <footer class="footer">
            <p>&copy; 2025 AIeta. All rights reserved. | Report Generated on <span>{current_generation_date}</span></p>
        </footer>
    </div>
</body>
</html>
    """
