export const LineHeader = ({ title }: { title: string }) => {
  return (
    <div className="flex items-center gap-4 md:px-6 px-4" >
      <h1 className="text-md font-bold">{title}</h1>
      <div className="h-0.5 flex-1 bg-gray-400" />
    </div>
  );
};
