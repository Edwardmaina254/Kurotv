export default function SocialRow() {
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#f0643b]/20 flex items-center justify-center overflow-hidden border border-[#f0643b]">
           <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Hamster" alt="Mascot" className="w-full h-full object-cover p-1" />
        </div>
        <div>
          <div className="text-[#4ade80] font-bold text-sm">Love this site?</div>
          <div className="text-gray-400 text-xs">Share it and let others know!</div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 ml-4">
         <span className="text-gray-500 text-[10px] uppercase tracking-wider mr-2 text-right">302k<br/>Shares</span>
         <button className="bg-[#1877f2] hover:bg-[#166fe5] text-white text-[11px] font-bold py-2.5 px-4 rounded md:rounded-md flex items-center gap-2 transition">
           <span className="font-serif text-sm">f</span> 56.9k
         </button>
         <button className="bg-black hover:bg-gray-900 border border-gray-800 text-white text-[11px] font-bold py-2.5 px-4 rounded md:rounded-md flex items-center gap-2 transition">
           𝕏 18.7k
         </button>
         <button className="bg-[#5865f2] hover:bg-[#4752c4] text-white text-[11px] font-bold py-2.5 px-4 rounded md:rounded-md flex items-center gap-2 transition">
           💬 55.8k
         </button>
         <button className="bg-[#ff4500] hover:bg-[#e03d00] text-white text-[11px] font-bold py-2.5 px-4 rounded md:rounded-md flex items-center gap-2 transition">
           <span className="w-3.5 h-3.5 rounded-full bg-white flex items-center justify-center text-[#ff4500]">r</span> 85.4k
         </button>
         <button className="bg-[#25d366] hover:bg-[#20bd5a] text-white text-[11px] font-bold py-2.5 px-4 rounded md:rounded-md flex items-center gap-2 transition">
           📱 6.8k
         </button>
         <button className="bg-[#0088cc] hover:bg-[#0077b5] text-white text-[11px] font-bold py-2.5 px-3 rounded md:rounded-md flex items-center gap-2 transition">
           ✈
         </button>
      </div>
    </div>
  );
}